const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../utils/auditLog');
const { sendVerificationEmail } = require('../utils/email');

const VERIFICATION_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;

// Helper: generate JWT
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Helper: generate a 6-digit code, store it, and email it.
// Email failures are logged but never thrown -- the account still
// exists either way, and the user can always request a resend.
const issueVerificationCode = async (userId, email, fullName) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await pool.query(
    "INSERT INTO email_verifications (user_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
    [userId, code]
  );
  try {
    await sendVerificationEmail(email, fullName, code);
  } catch (error) {
    console.error('Failed to send verification email:', error.message);
  }
};

// ── REGISTER ─────────────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { full_name, email, password, role = 'citizen', region_id, phone } = req.body;

  try {
    // Check if email taken
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Only allow citizen role from public registration; staff created by admin
    const safeRole = ['citizen'].includes(role) ? role : 'citizen';

    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, region_id, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [full_name, email, password_hash, safeRole, region_id || null, phone || null]
    );

    const userId = result.rows[0].id;
    await auditLog(userId, 'REGISTER', 'users', userId, req.ip);
    await issueVerificationCode(userId, email, full_name);

    // No token here -- the account isn't usable until the code is
    // verified. The frontend should route straight to the
    // verify-email screen with this email pre-filled.
    res.status(201).json({
      success: true,
      message: 'Account created. Check your email for a 6-digit verification code.',
      data: { email, requiresVerification: true },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

// ── VERIFY EMAIL ───────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const { email, code } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT id, full_name, email, role, region_id, phone, avatar_url, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'No account found for this email' });
    }
    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ success: false, alreadyVerified: true, message: 'This account is already verified — please log in.' });
    }

    const codeResult = await pool.query(
      'SELECT id, code, attempts FROM email_verifications WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    if (!codeResult.rows.length) {
      return res.status(400).json({ success: false, message: 'Your code has expired. Request a new one.' });
    }

    const verification = codeResult.rows[0];

    if (verification.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
    }

    if (verification.code !== String(code).trim()) {
      await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [verification.id]);
      const remaining = VERIFICATION_MAX_ATTEMPTS - 1 - verification.attempts;
      return res.status(400).json({ success: false, message: `Incorrect code. ${remaining} attempt(s) remaining.` });
    }

    await pool.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [user.id]);
    await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [user.id]);
    await auditLog(user.id, 'VERIFY_EMAIL', 'users', user.id, req.ip);

    const token = generateToken(user.id);
    res.json({ success: true, message: 'Email verified', token, user: { ...user, email_verified: true } });
  } catch (error) {
    console.error('verifyEmail error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// ── RESEND VERIFICATION CODE ────────────────────────────────────
exports.resendVerification = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  // Always the same response regardless of whether the account exists
  // or is already verified, so this endpoint can't be used to enumerate
  // registered emails.
  const genericResponse = { success: true, message: 'If that account needs verification, a new code has been sent.' };

  try {
    const userResult = await pool.query('SELECT id, full_name, email_verified FROM users WHERE email = $1', [email]);
    if (!userResult.rows.length) return res.json(genericResponse);
    const user = userResult.rows[0];
    if (user.email_verified) return res.json(genericResponse);

    const recent = await pool.query(
      'SELECT created_at FROM email_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );
    if (recent.rows.length) {
      const secondsSince = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
      if (secondsSince < RESEND_COOLDOWN_SEC) {
        return res.status(429).json({ success: false, message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SEC - secondsSince)}s before requesting another code.` });
      }
    }

    await issueVerificationCode(user.id, email, user.full_name);
    res.json(genericResponse);
  } catch (error) {
    console.error('resendVerification error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend code' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash, role, region_id, phone, avatar_url, is_active, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: 'Please verify your email before logging in.',
      });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await auditLog(user.id, 'LOGIN', 'users', user.id, req.ip);

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.json({ success: true, message: 'Login successful', token, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ── GET PROFILE ───────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.region_id, u.phone, u.avatar_url,
              u.is_active, u.last_login, u.created_at, r.name AS region_name
       FROM users u LEFT JOIN regions r ON u.region_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ── UPDATE PROFILE ────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const { full_name, phone, region_id } = req.body;

  try {
    await pool.query(
      'UPDATE users SET full_name = $1, phone = $2, region_id = $3, updated_at = NOW() WHERE id = $4',
      [full_name, phone || null, region_id || null, req.user.id]
    );

    const updated = await pool.query(
      'SELECT id, full_name, email, role, region_id, phone, avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated', user: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ── CHANGE PASSWORD ───────────────────────────────────────────
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);

    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password change failed' });
  }
};

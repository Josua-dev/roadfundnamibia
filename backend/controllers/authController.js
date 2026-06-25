const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../utils/auditLog');

// Helper: generate JWT
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

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

    const token = generateToken(userId);

    const user = await pool.query(
      'SELECT id, full_name, email, role, region_id, phone, created_at FROM users WHERE id = $1',
      [userId]
    );

    res.status(201).json({ success: true, message: 'Account created successfully', token, user: user.rows[0] });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
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
      'SELECT id, full_name, email, password_hash, role, region_id, phone, avatar_url, is_active FROM users WHERE email = $1',
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

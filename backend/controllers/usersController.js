const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// ── GET ALL USERS ─────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    let where = ['1=1'];
    let params = [];

    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      where.push(`(u.full_name ILIKE $${params.length - 1} OR u.email ILIKE $${params.length})`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${where.join(' AND ')}`, params
    );

    const limitParams = [...params, parseInt(limit), offset];
    const users = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.is_active,
              u.last_login, u.created_at, r.name AS region_name,
              (SELECT COUNT(*) FROM reports rp WHERE rp.reported_by = u.id) AS report_count
       FROM users u LEFT JOIN regions r ON u.region_id = r.id
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
      limitParams
    );

    const total = countResult.rows[0].total;
    res.json({
      success: true,
      data: users.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ── CREATE USER (admin) ───────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const { full_name, email, password, role, region_id, phone } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, region_id, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [full_name, email, password_hash, role, region_id || null, phone || null]
    );

    res.status(201).json({ success: true, message: 'User created', data: { id: result.rows[0].id } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// ── UPDATE USER ───────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const { full_name, email, role, region_id, phone, is_active } = req.body;
    const userId = req.params.id;

    await pool.query(
      'UPDATE users SET full_name=$1, email=$2, role=$3, region_id=$4, phone=$5, is_active=$6, updated_at=NOW() WHERE id=$7',
      [full_name, email, role, region_id || null, phone || null, is_active, userId]
    );

    res.json({ success: true, message: 'User updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ── TOGGLE USER STATUS ────────────────────────────────────────
exports.toggleStatus = async (req, res) => {
  try {
    const users = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [req.params.id]);
    if (!users.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const newStatus = !users.rows[0].is_active;
    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [newStatus, req.params.id]);

    res.json({ success: true, message: `User ${newStatus ? 'activated' : 'deactivated'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Status toggle failed' });
  }
};

// ── RESET PASSWORD (admin) ────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

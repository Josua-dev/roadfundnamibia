const pool = require('../config/database');

// ── GET AUDIT LOGS (admin only) ─────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const { action, entity_type, user_id, page = 1, limit = 25 } = req.query;
    let where = ['1=1'];
    let params = [];

    if (action) { params.push(`%${action}%`); where.push(`al.action ILIKE $${params.length}`); }
    if (entity_type) { params.push(entity_type); where.push(`al.entity_type = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`al.user_id = $${params.length}`); }

    const whereStr = where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs al WHERE ${whereStr}`, params
    );

    const limitParams = [...params, parseInt(limit), offset];
    const logs = await pool.query(
      `SELECT al.*, u.full_name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE ${whereStr}
       ORDER BY al.created_at DESC
       LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
      limitParams
    );

    const total = countResult.rows[0].total;
    res.json({
      success: true,
      data: logs.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

// ── Distinct action/entity_type values, for filter dropdowns ───
exports.getAuditMeta = async (req, res) => {
  try {
    const actions = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    const entityTypes = await pool.query("SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type");
    res.json({
      success: true,
      data: {
        actions: actions.rows.map(r => r.action),
        entity_types: entityTypes.rows.map(r => r.entity_type),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch filter options' });
  }
};

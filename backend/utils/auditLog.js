const pool = require('../config/database');

/**
 * Records an entry in audit_logs. Fire-and-forget by design — an audit
 * log failure should never break the actual action it's recording, so
 * errors are swallowed (but logged to the console for ops visibility).
 */
const auditLog = async (userId, action, entityType, entityId, ip) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, entityType, entityId, ip || null]
    );
  } catch (error) {
    console.error('audit log write failed:', error.message);
  }
};

module.exports = { auditLog };

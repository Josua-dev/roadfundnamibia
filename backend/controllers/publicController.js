const pool = require('../config/database');

// ── PUBLIC STATS (no auth — landing page) ───────────────────────
// Intentionally minimal: counts only, nothing that could leak
// anything sensitive to an anonymous visitor.
exports.getStats = async (req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM reports) AS total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'completed') AS roads_repaired,
        (SELECT COUNT(*) FROM regions) AS regions
    `);
    const byIssueType = await pool.query(
      `SELECT issue_type, COUNT(*) AS count FROM reports GROUP BY issue_type`
    );
    res.json({
      success: true,
      data: { ...totals.rows[0], by_issue_type: byIssueType.rows },
    });
  } catch (error) {
    console.error('getPublicStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

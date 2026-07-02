const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

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

// ── PUBLIC IMPACT (before/after proof, no auth) ─────────────────
// Only reports that are completed AND have at least one 'completed'
// stage photo qualify -- i.e. there's an actual after-photo to show,
// not just a status flag.
exports.getImpact = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id, r.report_number, r.title, r.issue_type, r.severity,
        r.resolved_at, r.created_at,
        rg.name AS region_name,
        latest_task.cost_estimate, latest_task.actual_cost,
        (SELECT file_path FROM attachments WHERE report_id = r.id AND stage = 'reported'  ORDER BY created_at ASC LIMIT 1) AS before_photo,
        (SELECT file_path FROM attachments WHERE report_id = r.id AND stage = 'completed' ORDER BY created_at ASC LIMIT 1) AS after_photo
      FROM reports r
      JOIN regions rg ON r.region_id = rg.id
      -- A report can have more than one maintenance_tasks row over its
      -- life (e.g. reassigned); take only the most recently updated
      -- one for cost figures, or a plain LEFT JOIN would fan this
      -- query out into one duplicate row per task.
      LEFT JOIN LATERAL (
        SELECT cost_estimate, actual_cost
        FROM maintenance_tasks
        WHERE report_id = r.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) latest_task ON true
      WHERE r.status = 'completed'
        AND EXISTS (SELECT 1 FROM attachments WHERE report_id = r.id AND stage = 'completed')
      ORDER BY r.resolved_at DESC
      LIMIT 24
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getImpact error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch impact data' });
  }
};

// ── PUBLIC LIVE MAP (no auth) ────────────────────────────────────
// Deliberately more conservative than the authenticated /reports/map:
// no free-text address (street-level text can be more identifying
// than raw coordinates), and coordinates rounded to ~3 decimal places
// (~100m) rather than the full ~1m precision stored internally --
// still shows "there's a problem on this road" without pinpointing
// an exact property to an anonymous visitor.
exports.getMapReports = async (req, res) => {
  try {
    const { region_id, status, severity } = req.query;
    let where = ['r.latitude IS NOT NULL AND r.longitude IS NOT NULL'];
    let params = [];

    if (region_id) { params.push(region_id); where.push(`r.region_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    if (severity) { params.push(severity); where.push(`r.severity = $${params.length}`); }

    const result = await pool.query(
      `SELECT r.id, r.report_number, r.issue_type, r.severity, r.status,
              ROUND(r.latitude::numeric, 3) AS latitude,
              ROUND(r.longitude::numeric, 3) AS longitude,
              r.created_at, rg.name AS region_name
       FROM reports r
       JOIN regions rg ON r.region_id = rg.id
       WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getMapReports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch map data' });
  }
};

// ── PUBLIC PHOTO SERVING (no auth) ──────────────────────────────
// Deliberately separate from the authenticated /api/uploads route.
// Only serves a file if it's actually attached to a report that's
// completed -- so this can never be used to access photos on
// in-progress or otherwise-private reports, regardless of filename
// guessing. That's the whole privacy boundary, so it's enforced at
// the query level, not just by routing.
exports.getPublicPhoto = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const result = await pool.query(
      `SELECT a.file_path FROM attachments a
       JOIN reports r ON r.id = a.report_id
       WHERE a.file_path LIKE $1 AND r.status = 'completed'`,
      [`%${filename}%`]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (error) {
    console.error('getPublicPhoto error:', error);
    res.status(500).json({ success: false, message: 'Could not serve file' });
  }
};

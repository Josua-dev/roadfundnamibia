const pool = require('../config/database');

// ── OVERVIEW STATS ────────────────────────────────────────────
// IMPORTANT: AdminDashboard.tsx reads this as a FLAT object
// (stats.total_reports, stats.total_users, stats.completed,
// stats.critical_open, stats.by_issue_type) — not nested. Keep it
// that way; don't reintroduce reports/users/tasks sub-objects.
exports.getOverview = async (req, res) => {
  try {
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_reports,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status IN ('reported','under_review')) AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        -- "Critical — Open" means still-unresolved critical reports,
        -- not the all-time count of everything ever marked critical.
        COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('completed','rejected')) AS critical_open,
        COUNT(*) FILTER (WHERE severity = 'high' AND status NOT IN ('completed','rejected')) AS high_open,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS this_month
      FROM reports
    `);
    const totals = totalsResult.rows[0];

    const userStatsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE role = 'citizen') AS citizens,
        COUNT(*) FILTER (WHERE role = 'inspector') AS inspectors,
        COUNT(*) FILTER (WHERE role = 'maintenance_officer') AS officers
      FROM users WHERE is_active = true
    `);
    const userStats = userStatsResult.rows[0];

    const taskStatsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS active_tasks,
        AVG(progress_percent) AS avg_progress,
        SUM(actual_cost) AS total_cost,
        SUM(cost_estimate) AS estimated_cost
      FROM maintenance_tasks
    `);
    const taskStats = taskStatsResult.rows[0];

    const byIssueTypeResult = await pool.query(`
      SELECT issue_type, COUNT(*) AS count FROM reports GROUP BY issue_type ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        ...totals,
        ...userStats,
        ...taskStats,
        by_issue_type: byIssueTypeResult.rows,
        completion_rate: totals.total_reports
          ? Math.round((totals.completed / totals.total_reports) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('getOverview error:', error);
    res.status(500).json({ success: false, message: 'Analytics fetch failed' });
  }
};

// ── MONTHLY CHART (admin dashboard bar chart) ──────────────────
// Distinct from getMonthlyTrend below: that one feeds the standalone
// Analytics page's multi-line chart (label/reported/completed/critical).
// This one feeds AdminDashboard's single bar chart, which expects
// the simpler { month, count } shape.
exports.getCharts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'Mon') AS month,
        COUNT(*) AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `);
    res.json({ success: true, data: { monthly: result.rows } });
  } catch (error) {
    console.error('getCharts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
};

// ── INSPECTOR PERSONAL STATS ───────────────────────────────────
exports.getInspectorStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM reports WHERE status = 'reported') AS pending,
        (SELECT COUNT(*) FROM reports WHERE status = 'under_review') AS under_review,
        (SELECT COUNT(*) FROM inspection_reports
           WHERE inspector_id = $1 AND verified = true
           AND inspection_date::date = CURRENT_DATE) AS verified_today,
        (SELECT COUNT(*) FROM reports
           WHERE severity = 'critical' AND status NOT IN ('completed','rejected')) AS critical_open
    `, [req.user.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getInspectorStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inspector stats' });
  }
};

// ── MAINTENANCE OFFICER PERSONAL STATS ─────────────────────────
exports.getMaintenanceStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM maintenance_tasks
           WHERE assigned_officer = $1 AND status IN ('pending','in_progress','paused')) AS active,
        (SELECT COUNT(*) FROM maintenance_tasks
           WHERE assigned_officer = $1 AND status = 'completed'
           AND actual_completion = CURRENT_DATE) AS completed
    `, [req.user.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getMaintenanceStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance stats' });
  }
};

// ── REPORTS BY REGION ─────────────────────────────────────────
exports.getByRegion = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rg.name AS region,
        COUNT(r.id) AS total,
        COUNT(*) FILTER (WHERE r.status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE r.status IN ('reported','under_review','verified')) AS pending,
        COUNT(*) FILTER (WHERE r.severity = 'critical') AS critical
      FROM regions rg
      LEFT JOIN reports r ON r.region_id = rg.id
      GROUP BY rg.id, rg.name
      ORDER BY total DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch region analytics' });
  }
};

// ── MONTHLY TREND ─────────────────────────────────────────────
exports.getMonthlyTrend = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
        TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') AS label,
        COUNT(*) AS reported,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch monthly trend' });
  }
};

// ── BY SEVERITY ───────────────────────────────────────────────
exports.getBySeverity = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT severity, COUNT(*) AS count FROM reports GROUP BY severity
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch severity data' });
  }
};

// ── BY STATUS ─────────────────────────────────────────────────
exports.getByStatus = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) AS count FROM reports GROUP BY status
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch status data' });
  }
};

// ── BY ISSUE TYPE ─────────────────────────────────────────────
exports.getByIssueType = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT issue_type, COUNT(*) AS count FROM reports GROUP BY issue_type ORDER BY count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch issue type data' });
  }
};

// ── CITIZEN STATS (personal) ──────────────────────────────────
exports.getCitizenStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status IN ('reported','under_review')) AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical
      FROM reports WHERE reported_by = $1
    `, [req.user.id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

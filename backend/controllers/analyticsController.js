const pool = require('../config/database');

// ── OVERVIEW STATS ────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_reports,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status IN ('reported','under_review')) AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
        COUNT(*) FILTER (WHERE severity = 'high') AS high_count,
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

    res.json({
      success: true,
      data: {
        reports: totals,
        users: userStats,
        tasks: taskStats,
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

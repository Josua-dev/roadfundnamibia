const pool = require('../config/database');
const { buildSetClause } = require('../utils/sqlHelpers');
const { auditLog } = require('../utils/auditLog');
const { notifyUser } = require('../utils/notify');

// ── GET ALL TASKS ─────────────────────────────────────────────
exports.getAllTasks = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'maintenance_officer') {
      params.push(req.user.id);
      where.push(`mt.assigned_officer = $${params.length}`);
    }
    if (req.user.role === 'inspector') {
      params.push(req.user.id);
      where.push(`mt.inspector_id = $${params.length}`);
    }

    if (status) { params.push(status); where.push(`mt.status = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`mt.priority = $${params.length}`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereStr = where.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM maintenance_tasks mt WHERE ${whereStr}`, params
    );

    const limitParams = [...params, parseInt(limit), offset];
    const tasks = await pool.query(
      `SELECT mt.*,
              r.report_number, r.title AS report_title, r.severity, r.status AS report_status,
              rg.name AS region_name,
              u.full_name AS officer_name,
              i.full_name AS inspector_name
       FROM maintenance_tasks mt
       JOIN reports r ON mt.report_id = r.id
       JOIN regions rg ON r.region_id = rg.id
       LEFT JOIN users u ON mt.assigned_officer = u.id
       LEFT JOIN users i ON mt.inspector_id = i.id
       WHERE ${whereStr}
       ORDER BY mt.created_at DESC LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
      limitParams
    );

    const total = countResult.rows[0].total;
    res.json({
      success: true,
      data: tasks.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getAllTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// ── CREATE TASK ───────────────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const { report_id, assigned_team, assigned_officer, inspector_id,
            priority, start_date, estimated_completion, notes, cost_estimate } = req.body;

    // Check report exists
    const reports = await pool.query('SELECT id, title, status FROM reports WHERE id = $1', [report_id]);
    if (!reports.rows.length) return res.status(404).json({ success: false, message: 'Report not found' });

    const result = await pool.query(
      `INSERT INTO maintenance_tasks
       (report_id, assigned_team, assigned_officer, inspector_id, priority, start_date, estimated_completion, notes, cost_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [report_id, assigned_team, assigned_officer || null, inspector_id || null,
       priority || 'normal', start_date || null, estimated_completion || null, notes || null, cost_estimate || null]
    );

    // Update report status to assigned
    await pool.query(
      "UPDATE reports SET status = 'assigned', assigned_to = $1, updated_at = NOW() WHERE id = $2",
      [assigned_officer || null, report_id]
    );

    // Notify assigned officer (in-app + email)
    if (assigned_officer) {
      await notifyUser(
        assigned_officer, 'New Maintenance Assignment', `You have been assigned a maintenance task for "${reports.rows[0].title}"`, 'assignment', report_id
      );
    }

    auditLog(req.user.id, 'CREATE_TASK', 'maintenance_tasks', result.rows[0].id, req.ip);
    res.status(201).json({ success: true, message: 'Task created', data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('createTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

// ── UPDATE TASK PROGRESS ──────────────────────────────────────
exports.updateTask = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid task ID' });
  }
  try {
    const { progress_percent, status, notes, actual_cost, actual_completion } = req.body;
    const taskId = req.params.id;

    const tasks = await pool.query('SELECT * FROM maintenance_tasks WHERE id = $1', [taskId]);
    if (!tasks.rows.length) return res.status(404).json({ success: false, message: 'Task not found' });

    const reportResult = await pool.query('SELECT id, title, status, reported_by FROM reports WHERE id = $1', [tasks.rows[0].report_id]);
    const report = reportResult.rows[0];

    const updates = {};
    if (progress_percent !== undefined) updates.progress_percent = progress_percent;
    if (status) updates.status = status;
    if (notes) updates.notes = notes;
    if (actual_cost) updates.actual_cost = actual_cost;
    if (actual_completion) updates.actual_completion = actual_completion;
    updates.updated_at = new Date();

    const { clause, values } = buildSetClause(updates);
    await pool.query(`UPDATE maintenance_tasks SET ${clause} WHERE id = $${values.length + 1}`, [...values, taskId]);

    // Sync report progress
    if (progress_percent !== undefined) {
      await pool.query(
        'UPDATE reports SET progress_percent = $1, updated_at = NOW() WHERE id = $2',
        [progress_percent, report.id]
      );
    }

    // Map task status -> report status, and only act when it actually
    // changes anything (e.g. saving notes alone shouldn't re-fire this).
    const reportStatusMap = { completed: 'completed', in_progress: 'in_progress' };
    const newReportStatus = reportStatusMap[status];

    if (newReportStatus && newReportStatus !== report.status) {
      if (newReportStatus === 'completed') {
        await pool.query(
          "UPDATE reports SET status = 'completed', progress_percent = 100, resolved_at = NOW() WHERE id = $1",
          [report.id]
        );
      } else {
        await pool.query(
          "UPDATE reports SET status = 'in_progress', updated_at = NOW() WHERE id = $1",
          [report.id]
        );
      }

      // This status change happened via the maintenance task, not the
      // report's own status endpoint -- so it needs its own
      // status_history entry, or the citizen-facing timeline on the
      // report page would silently skip straight from "assigned" to
      // "completed" with no record of work having started.
      await pool.query(
        'INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
        [report.id, report.status, newReportStatus, req.user.id, notes || `Updated via maintenance task #${taskId}`]
      );

      await notifyUser(
        report.reported_by,
        newReportStatus === 'completed' ? 'Report Resolved' : 'Work Has Started',
        newReportStatus === 'completed'
          ? `Good news — your report "${report.title}" has been marked as resolved!`
          : `Work has started on your report "${report.title}".`,
        'status_update',
        report.id
      );
    }

    auditLog(req.user.id, 'UPDATE_TASK', 'maintenance_tasks', parseInt(taskId), req.ip);
    res.json({ success: true, message: 'Task updated' });
  } catch (error) {
    console.error('updateTask error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ── GET SINGLE TASK ───────────────────────────────────────────
exports.getTask = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid task ID' });
  }
  try {
    const tasks = await pool.query(
      `SELECT mt.*,
              r.report_number, r.title AS report_title, r.description, r.severity, r.issue_type,
              r.latitude, r.longitude, r.address,
              rg.name AS region_name,
              u.full_name AS officer_name, u.email AS officer_email,
              i.full_name AS inspector_name
       FROM maintenance_tasks mt
       JOIN reports r ON mt.report_id = r.id
       JOIN regions rg ON r.region_id = rg.id
       LEFT JOIN users u ON mt.assigned_officer = u.id
       LEFT JOIN users i ON mt.inspector_id = i.id
       WHERE mt.id = $1`,
      [req.params.id]
    );

    if (!tasks.rows.length) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: tasks.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
};

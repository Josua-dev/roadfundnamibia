const pool = require('../config/database');
const { buildSetClause } = require('../utils/sqlHelpers');

// Generate report number — race-condition-safe via INSERT ... ON CONFLICT
// (the report_sequences table is created by database/schema.sql; this
// CREATE TABLE IF NOT EXISTS is just a self-healing safety net)
const ensureSequenceTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS report_sequences (
      year     SMALLINT NOT NULL,
      last_seq INTEGER  NOT NULL DEFAULT 0,
      PRIMARY KEY (year)
    )
  `);
};

const generateReportNumber = async (client) => {
  await ensureSequenceTable(client);
  const year = new Date().getFullYear();
  const result = await client.query(
    `INSERT INTO report_sequences (year, last_seq) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_seq = report_sequences.last_seq + 1
     RETURNING last_seq`,
    [year]
  );
  const seq = result.rows[0].last_seq;
  return `RF-${year}-${String(seq).padStart(4, '0')}`;
};

// Helper: create notification
const createNotification = async (userId, title, message, type, reportId) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, report_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, title, message, type, reportId]
    );
  } catch (_) {}
};

// ── GET ALL REPORTS ───────────────────────────────────────────
exports.getAllReports = async (req, res) => {
  try {
    const {
      status, severity, region_id, issue_type,
      search, page = 1, limit = 10,
      sort_by = 'created_at', sort_dir, sort_order
    } = req.query;

    let where = ['1=1'];
    let params = [];

    // Role-based filtering
    if (req.user.role === 'citizen') {
      params.push(req.user.id);
      where.push(`r.reported_by = $${params.length}`);
    }

    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    if (severity) { params.push(severity); where.push(`r.severity = $${params.length}`); }
    if (region_id) { params.push(region_id); where.push(`r.region_id = $${params.length}`); }
    if (issue_type) { params.push(issue_type); where.push(`r.issue_type = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      where.push(`(r.title ILIKE $${params.length - 2} OR r.report_number ILIKE $${params.length - 1} OR r.address ILIKE $${params.length})`);
    }

    const whereStr = where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM reports r WHERE ${whereStr}`,
      params
    );
    const total = countResult.rows[0].total;

    const allowedSort = ['created_at', 'severity', 'status', 'title'];
    const safeSort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const safeDir = (sort_order || sort_dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const limitParams = [...params, parseInt(limit), offset];
    const reports = await pool.query(
      `SELECT r.*,
              u.full_name AS reporter_name, u.email AS reporter_email,
              a.full_name AS assignee_name,
              rg.name AS region_name,
              (SELECT COUNT(*) FROM attachments att WHERE att.report_id = r.id) AS attachment_count
       FROM reports r
       JOIN users u ON r.reported_by = u.id
       LEFT JOIN users a ON r.assigned_to = a.id
       JOIN regions rg ON r.region_id = rg.id
       WHERE ${whereStr}
       ORDER BY r.${safeSort} ${safeDir}
       LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
      limitParams
    );

    res.json({
      success: true,
      data: reports.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('getAllReports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

// ── GET SINGLE REPORT ─────────────────────────────────────────
exports.getReport = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid report ID' });
  }
  try {
    const reports = await pool.query(
      `SELECT r.*,
              u.full_name AS reporter_name, u.email AS reporter_email, u.phone AS reporter_phone,
              a.full_name AS assignee_name,
              rg.name AS region_name
       FROM reports r
       JOIN users u ON r.reported_by = u.id
       LEFT JOIN users a ON r.assigned_to = a.id
       JOIN regions rg ON r.region_id = rg.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!reports.rows.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports.rows[0];

    // Ownership check for citizens
    if (req.user.role === 'citizen' && report.reported_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get attachments
    const attachments = await pool.query(
      'SELECT * FROM attachments WHERE report_id = $1 ORDER BY created_at ASC',
      [report.id]
    );

    // Get status history
    const history = await pool.query(
      `SELECT sh.*, u.full_name AS changed_by_name
       FROM status_history sh
       JOIN users u ON sh.changed_by = u.id
       WHERE sh.report_id = $1 ORDER BY sh.created_at ASC`,
      [report.id]
    );

    // Get maintenance task if any
    const tasks = await pool.query(
      `SELECT mt.*, u.full_name AS officer_name, i.full_name AS inspector_name
       FROM maintenance_tasks mt
       LEFT JOIN users u ON mt.assigned_officer = u.id
       LEFT JOIN users i ON mt.inspector_id = i.id
       WHERE mt.report_id = $1`,
      [report.id]
    );

    res.json({
      success: true,
      data: { ...report, attachments: attachments.rows, history: history.rows, maintenance_task: tasks.rows[0] || null },
    });
  } catch (error) {
    console.error('getReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
};

// ── CREATE REPORT ─────────────────────────────────────────────
exports.createReport = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { title, description, issue_type, severity, region_id, latitude, longitude, address } = req.body;

    // Race-condition-safe report number generation (inside transaction)
    const report_number = await generateReportNumber(client);

    const result = await client.query(
      `INSERT INTO reports (report_number, title, description, issue_type, severity, region_id,
        latitude, longitude, address, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [report_number, title, description, issue_type, severity || 'medium',
       region_id, latitude || null, longitude || null, address || null, req.user.id]
    );

    const reportId = result.rows[0].id;

    // Save attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await client.query(
          'INSERT INTO attachments (report_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [reportId, file.originalname, `/api/uploads/${file.filename}`, file.size, file.mimetype, req.user.id]
        );
      }
    }

    // Log initial status history
    await client.query(
      'INSERT INTO status_history (report_id, new_status, changed_by, notes) VALUES ($1, $2, $3, $4)',
      [reportId, 'reported', req.user.id, 'Report submitted by citizen']
    );

    await client.query('COMMIT');

    // Notifications are fire-and-forget (outside transaction — non-critical)
    pool.query("SELECT id FROM users WHERE role IN ('admin','inspector') AND is_active = true")
      .then((adminsResult) =>
        Promise.allSettled(
          adminsResult.rows.map((admin) =>
            createNotification(admin.id, 'New Road Report', `New ${severity || 'medium'} report: ${title}`, 'alert', reportId)
          )
        )
      )
      .catch((e) => console.error('Notification dispatch error:', e));

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: { id: reportId, report_number },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createReport error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  } finally {
    client.release();
  }
};

// ── UPDATE REPORT STATUS ──────────────────────────────────────
exports.updateStatus = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid report ID' });
  }
  try {
    const { status, notes, assigned_to, progress_percent } = req.body;
    const reportId = req.params.id;

    const existing = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Report not found' });

    const old = existing.rows[0];

    const updates = { status, updated_at: new Date() };
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (progress_percent !== undefined) updates.progress_percent = progress_percent;
    if (status === 'completed') { updates.resolved_at = new Date(); updates.progress_percent = 100; }

    const { clause, values } = buildSetClause(updates);
    await pool.query(`UPDATE reports SET ${clause} WHERE id = $${values.length + 1}`, [...values, reportId]);

    // Track history
    if (status !== old.status) {
      await pool.query(
        'INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)',
        [reportId, old.status, status, req.user.id, notes || null]
      );

      // Notify reporter
      await createNotification(
        old.reported_by,
        'Report Status Updated',
        `Your report "${old.title}" status changed to: ${status.replace('_', ' ')}`,
        'status_update',
        reportId
      );
    }

    res.json({ success: true, message: 'Report updated successfully' });
  } catch (error) {
    console.error('updateStatus error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ── DELETE REPORT ─────────────────────────────────────────────
exports.deleteReport = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid report ID' });
  }
  try {
    const existing = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Report not found' });

    // Only admin or owner can delete
    if (req.user.role !== 'admin' && existing.rows[0].reported_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

// ── MAP DATA ─────────────────────────────────────────────────
exports.getMapData = async (req, res) => {
  try {
    const { region_id, status, severity } = req.query;
    let where = ['r.latitude IS NOT NULL AND r.longitude IS NOT NULL'];
    let params = [];

    if (region_id) { params.push(region_id); where.push(`r.region_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    if (severity) { params.push(severity); where.push(`r.severity = $${params.length}`); }

    const result = await pool.query(
      `SELECT r.id, r.report_number, r.title, r.issue_type, r.severity, r.status,
              r.latitude, r.longitude, r.address, r.created_at,
              rg.name AS region_name
       FROM reports r
       JOIN regions rg ON r.region_id = rg.id
       WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch map data' });
  }
};

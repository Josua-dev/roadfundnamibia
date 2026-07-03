const express  = require('express');
const path     = require('path');
const { authenticateToken } = require('../middleware/auth');
const pool     = require('../config/database');
const { downloadFile } = require('../utils/storage');

const router = express.Router();

/**
 * GET /api/uploads/:filename
 * Serves uploaded files only to authenticated users.
 * Citizens may only access files attached to their own reports.
 * Staff (inspector, maintenance_officer, admin) may access all.
 */
router.get('/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // strip any path traversal

    // Confirm the file is a real attachment before hitting storage at
    // all -- also doubles as the existence check (there's no local
    // fs.existsSync anymore now that files live in Supabase Storage).
    const attachment = await pool.query(
      `SELECT a.id, r.reported_by FROM attachments a
       JOIN reports r ON r.id = a.report_id
       WHERE a.file_path LIKE $1`,
      [`%${filename}%`]
    );
    if (!attachment.rows.length) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Citizens: verify the file belongs to one of their own reports
    if (req.user.role === 'citizen' && attachment.rows[0].reported_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { buffer, contentType } = await downloadFile(filename);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    console.error('Upload serve error:', err);
    res.status(500).json({ success: false, message: 'Could not serve file' });
  }
});

module.exports = router;

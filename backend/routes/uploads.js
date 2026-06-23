const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const { authenticateToken } = require('../middleware/auth');
const pool     = require('../config/database');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

/**
 * GET /api/uploads/:filename
 * Serves uploaded files only to authenticated users.
 * Citizens may only access files attached to their own reports.
 * Staff (inspector, maintenance_officer, admin) may access all.
 */
router.get('/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // strip any path traversal
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Citizens: verify the file belongs to one of their reports
    if (req.user.role === 'citizen') {
      const result = await pool.query(
        `SELECT a.id FROM attachments a
         JOIN reports r ON r.id = a.report_id
         WHERE a.file_path LIKE $1 AND r.reported_by = $2`,
        [`%${filename}%`, req.user.id]
      );
      if (!result.rows.length) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error('Upload serve error:', err);
    res.status(500).json({ success: false, message: 'Could not serve file' });
  }
});

module.exports = router;

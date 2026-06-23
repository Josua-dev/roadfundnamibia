const pool = require('../config/database');

exports.getNotifications = async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT n.*, r.report_number FROM notifications n
       LEFT JOIN reports r ON n.report_id = r.id
       WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    const unread = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ success: true, data: rows.rows, unread_count: unread.rows[0].count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { ids } = req.body; // array of notification ids, or 'all'
    if (ids === 'all') {
      await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    } else if (Array.isArray(ids)) {
      // $1::int[] + ANY() is the Postgres equivalent of mysql2's `IN (?)` array expansion
      await pool.query(
        'UPDATE notifications SET is_read = true WHERE id = ANY($1::int[]) AND user_id = $2',
        [ids, req.user.id]
      );
    }
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

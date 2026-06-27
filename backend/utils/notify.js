const pool = require('../config/database');
const { sendNotificationEmail } = require('./email');

/**
 * Creates an in-app notification AND emails the same message.
 * Fire-and-forget by design, same as auditLog -- a notification or
 * email failure should never break the action that triggered it
 * (a status update succeeding shouldn't roll back because Resend
 * had a bad moment).
 */
async function notifyUser(userId, title, message, type, reportId = null) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, report_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, title, message, type, reportId]
    );
  } catch (error) {
    console.error('notification insert failed:', error.message);
  }

  try {
    const userResult = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length) {
      const { email, full_name } = userResult.rows[0];
      await sendNotificationEmail(email, full_name, title, message, reportId);
    }
  } catch (error) {
    console.error('notification email failed:', error.message);
  }
}

module.exports = { notifyUser };

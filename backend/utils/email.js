const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const FROM = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'RoadSafe Namibia <noreply@gmail.com>';

/**
 * Sends a 6-digit verification code by email.
 *
 * If GMAIL_USER / GMAIL_APP_PASSWORD aren't set (local dev without email
 * configured), this logs the code to the console instead of throwing — so
 * the rest of the signup flow is still testable.
 */
async function sendVerificationEmail(to, fullName, code) {
  if (!transporter) {
    console.warn(`[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — verification code for ${to}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your RoadSafe Namibia account',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin-bottom: 4px;">RoadSafe Namibia</h2>
        <p style="color: #555;">Hi ${fullName || 'there'},</p>
        <p style="color: #555;">Use this code to verify your account. It expires in 10 minutes.</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px;">If you didn't sign up for RoadSafe Namibia, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Sends a general notification email (status changes, assignments, etc.)
 */
async function sendNotificationEmail(to, fullName, title, message, reportId) {
  if (!transporter) {
    console.warn(`[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — notification for ${to}: ${title} — ${message}`);
    return;
  }

  const ctaUrl = reportId && process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/dashboard/reports/${reportId}`
    : null;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: title,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin-bottom: 4px;">RoadSafe Namibia</h2>
        <p style="color: #555;">Hi ${fullName || 'there'},</p>
        <p style="color: #555; line-height: 1.6;">${message}</p>
        ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block; margin-top:12px; background:#15803d; color:white; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:600;">View Report</a>` : ''}
        <p style="color: #aaa; font-size: 12px; margin-top: 24px;">You're receiving this because you have an account on RoadSafe Namibia.</p>
      </div>
    `,
  });
}

/**
 * Sends a password reset link by email.
 */
async function sendPasswordResetEmail(to, fullName, resetUrl) {
  if (!transporter) {
    console.warn(`[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your RoadSafe Namibia password',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin-bottom: 4px;">RoadSafe Namibia</h2>
        <p style="color: #555;">Hi ${fullName || 'there'},</p>
        <p style="color: #555;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block; margin: 20px 0; background:#28384A; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">
          Reset My Password
        </a>
        <p style="color: #888; font-size: 13px;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
        <p style="color: #bbb; font-size: 12px; word-break: break-all;">Or copy this link: ${resetUrl}</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendNotificationEmail, sendPasswordResetEmail };

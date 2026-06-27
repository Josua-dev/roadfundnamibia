let resend = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Sends a 6-digit verification code by email.
 *
 * If RESEND_API_KEY isn't set (e.g. local dev without it configured),
 * this logs the code to the console instead of throwing -- so the rest
 * of the signup flow is still testable without a real email account.
 */
async function sendVerificationEmail(to, fullName, code) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — verification code for ${to}: ${code}`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'RoadSafe Namibia <onboarding@resend.dev>',
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
 * Sends a general notification email (status changes, assignments,
 * etc.) -- distinct from sendVerificationEmail, which is OTP-specific.
 * Same no-op-with-console-log fallback when Resend isn't configured.
 */
async function sendNotificationEmail(to, fullName, title, message, reportId) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — notification for ${to}: ${title} — ${message}`);
    return;
  }

  const ctaUrl = reportId && process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/dashboard/reports/${reportId}`
    : null;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'RoadSafe Namibia <onboarding@resend.dev>',
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

module.exports = { sendVerificationEmail, sendNotificationEmail };

const nodemailer = require('nodemailer');

let transporter = null;

// Hard timeouts so a stalled SMTP connection (e.g. Render's free tier
// often can't reach Gmail's outbound ports) fails fast instead of hanging
// the request indefinitely. Without these, sendMail waits on a socket that
// never connects and the register/verify flow blocks forever with no
// response. sendMailTimeoutMs is a belt-and-braces cap on the whole call.
const SMTP_CONNECT_TIMEOUT_MS = 5000;
const SENDMAIL_TIMEOUT_MS = 12000;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: SMTP_CONNECT_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECT_TIMEOUT_MS,
    socketTimeout: SENDMAIL_TIMEOUT_MS,
  });
} else {
  // Loud at startup, not buried in a per-request console.warn. Email is the
  // thing that's silently broken right now, so surface it as clearly as
  // possible rather than letting users sign up and never get a code.
  console.warn(
    '[email] ⚠️  Gmail SMTP NOT CONFIGURED — set both GMAIL_USER and GMAIL_APP_PASSWORD.\n' +
      '[email]    (App Password from https://myaccount.google.com/apppasswords, requires 2FA.)\n' +
      '[email]    Verification codes and notification emails will be logged to console and NOT delivered.'
  );
}

const FROM = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'RoadSafe Namibia <noreply@gmail.com>';

/**
 * Sends mail with a hard ceiling on total time. Even with the
 * transporter's socketTimeout, some failures (DNS, TLS, hung sockets)
 * can outlive a single read timeout, so we race the send against a
 * deadline too. On timeout the SMTP connection is closed so it can't
 * keep the process alive.
 */
async function sendMailWithTimeout(mailOptions) {
  if (!transporter) {
    throw new Error('Email not sent: GMAIL_USER / GMAIL_APP_PASSWORD are not both set');
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      transporter.close();
      reject(new Error('Email send timed out (SMTP unreachable)'));
    }, SENDMAIL_TIMEOUT_MS);
    transporter.sendMail(mailOptions).then(
      (info) => { clearTimeout(timer); resolve(info); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Sends a 6-digit verification code by email.
 *
 * If GMAIL_USER / GMAIL_APP_PASSWORD aren't set, this logs the code to the
 * console (so local dev remains testable) AND throws — callers must not
 * mistake "no email was sent" for success.
 */
async function sendVerificationEmail(to, fullName, code) {
  if (!transporter) {
    // Kept as a hard throw (not a silent return) so callers can't mistake
    // "no email was sent" for success. The code is still logged here so
    // local/dev flows remain testable without real SMTP credentials.
    console.warn(`[email] Gmail not configured — verification code for ${to}: ${code} (NOT emailed)`);
    throw new Error('Email not sent: GMAIL_USER / GMAIL_APP_PASSWORD are not both set');
  }

  await sendMailWithTimeout({
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
    console.warn(`[email] Gmail not configured — notification for ${to}: ${title} (NOT emailed)`);
    throw new Error('Email not sent: GMAIL_USER / GMAIL_APP_PASSWORD are not both set');
  }

  const ctaUrl = reportId && process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/dashboard/reports/${reportId}`
    : null;

  await sendMailWithTimeout({
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
    console.warn(`[email] Gmail not configured — password reset link for ${to}: ${resetUrl} (NOT emailed)`);
    throw new Error('Email not sent: GMAIL_USER / GMAIL_APP_PASSWORD are not both set');
  }

  await sendMailWithTimeout({
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

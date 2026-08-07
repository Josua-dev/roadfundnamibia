/**
 * Transactional email delivery.
 *
 * Two paths, chosen automatically:
 *   1. RESEND_API_KEY set      -> Resend's HTTP API (https://api.resend.com/emails).
 *      This is the production path. It goes out over HTTPS/port 443, which
 *      Render's free tier DOES allow — unlike outbound SMTP (port 465/587),
 *      which Render free blocks and which made Gmail's App Password stall.
 *   2. GMAIL_USER + GMAIL_APP_PASSWORD set -> Gmail SMTP. Kept as a local/dev
 *      fallback, since that still works from a normal (non-Render) machine.
 *
 * Both paths are wrapped in hard timeouts so a stalled connection fails fast
 * (surfaces `emailSent:false` to the caller) instead of hanging the
 * register/verify request indefinitely.
 */
const nodemailer = require('nodemailer');

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// Transport selection
// ---------------------------------------------------------------------------

function hasResend() {
  return Boolean(process.env.RESEND_API_KEY);
}

function gmailTransporter() {
  if (!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: SEND_TIMEOUT_MS,
  });
}

if (!hasResend() && !gmailTransporter()) {
  console.warn(
    '[email] ⚠️  NO EMAIL PROVIDER CONFIGURED — set RESEND_API_KEY (production, works on Render) ' +
      'or GMAIL_USER + GMAIL_APP_PASSWORD (local dev).\n' +
      '[email]    Verification codes will be logged to console and NOT delivered.'
  );
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

/** Send via Resend's HTTPS API. Throws on non-2xx or timeout. */
async function sendViaResend({ from, to, subject, html }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${body}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Send via GmailSMTP, raced against a deadline so a hung socket can't block. */
async function sendGmail(mailOptions) {
  const transporter = gmailTransporter();
  if (!transporter) throw new Error('Gmail not configured');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      transporter.close();
      reject(new Error('Email send timed out (SMTP unreachable)'));
    }, SEND_TIMEOUT_MS);
    transporter.sendMail(mailOptions).then(
      (info) => { clearTimeout(timer); resolve(info); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/** The one dispatch point the three functions below call. */
async function deliver(mailOptions) {
  if (hasResend()) return sendViaResend(mailOptions);
  try {
    return await sendGmail(mailOptions);
  } catch (error) {
    // Local dev / unconfigured: log the body so the flow stays testable
    // without a working sender, but still throw so callers know it wasn't sent.
    console.warn(`[email] NOT sent (${error.message}). To: ${mailOptions.to}`);
    console.warn(`[email] subject: ${mailOptions.subject}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Message builders & exported senders
// ---------------------------------------------------------------------------

const FROM = process.env.EMAIL_FROM || 'RoadSafe Namibia <onboarding@resend.dev>';

/**
 * Sends a 6-digit verification code.
 */
async function sendVerificationEmail(to, fullName, code) {
  await deliver({
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
  const ctaUrl = reportId && process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/dashboard/reports/${reportId}`
    : null;

  await deliver({
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
 * Sends a password reset link.
 */
async function sendPasswordResetEmail(to, fullName, resetUrl) {
  await deliver({
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
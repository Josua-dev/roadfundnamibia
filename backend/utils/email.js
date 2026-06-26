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

module.exports = { sendVerificationEmail };

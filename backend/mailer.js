// Sends the password-reset email. Requires real SMTP credentials in .env —
// see .env.example for what to fill in. Without them, this logs the reset
// link to the console instead of emailing it, so local development still
// works without an email account configured.
const nodemailer = require("nodemailer");

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendResetEmail({ to, username, token }) {
  const appUrl = process.env.APP_URL || "http://localhost:8000";
  const resetLink = `${appUrl}/reset-password.html?reset_token=${token}`;
  const transport = getTransport();

  if (!transport) {
    console.log("\n--- SMTP not configured. Reset link (for local testing) ---");
    console.log(`${username}: ${resetLink}`);
    console.log("-------------------------------------------------------------\n");
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your Brainiac Quizzes password",
    text: `Hi ${username},\n\nSomeone requested a password reset for your Brainiac Quizzes account. Click the link below to set a new password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
  });
}

module.exports = { sendResetEmail };

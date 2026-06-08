import { getCanonicalBaseUrl } from "./config.js";

function getFromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Mixly <onboarding@resend.dev>"
  );
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getEmailConfigError() {
  if (!isEmailConfigured()) {
    return "Email is not configured. Add RESEND_API_KEY in your environment.";
  }
  return null;
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY.trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Email send failed (${res.status})`);
  }

  return body;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!to?.trim()) {
    throw new Error("Recipient email is required");
  }

  if (!isEmailConfigured()) {
    console.warn("[email] RESEND_API_KEY is not set. Email not sent:", {
      to,
      subject,
      text,
    });
    return { ok: true, dev: true };
  }

  await sendViaResend({ to: to.trim(), subject, html, text });
  return { ok: true };
}

function appName() {
  return "Mixly";
}

export async function sendVerificationEmail({ to, token }) {
  const baseUrl = getCanonicalBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const subject = `Verify your ${appName()} email`;
  const text = [
    `Welcome to ${appName()}!`,
    "",
    "Please verify your email address by opening this link:",
    verifyUrl,
    "",
    "This link expires in 24 hours.",
    "",
    "If you did not create an account, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Welcome to ${appName()}!</p>
    <p>Please verify your email address:</p>
    <p><a href="${verifyUrl}">Verify email</a></p>
    <p>Or copy this link into your browser:<br>${verifyUrl}</p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create an account, you can ignore this email.</p>
  `;

  return sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail({ to, token }) {
  const baseUrl = getCanonicalBaseUrl();
  const resetUrl = `${baseUrl}/?reset=${encodeURIComponent(token)}`;
  const subject = `Reset your ${appName()} password`;
  const text = [
    `We received a request to reset your ${appName()} password.`,
    "",
    "Open this link to choose a new password:",
    resetUrl,
    "",
    "This link expires in 1 hour.",
    "",
    "If you did not request a password reset, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>We received a request to reset your ${appName()} password.</p>
    <p><a href="${resetUrl}">Reset password</a></p>
    <p>Or copy this link into your browser:<br>${resetUrl}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request a password reset, you can ignore this email.</p>
  `;

  return sendEmail({ to, subject, html, text });
}

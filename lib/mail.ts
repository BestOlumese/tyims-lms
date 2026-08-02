import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email over Gmail SMTP.
 *
 * Used only for security-sensitive events an account owner must learn about even if
 * someone else is holding their session — PIN changes, bank-detail changes, payouts.
 * Everything else stays as in-app notifications.
 *
 * Setup: GMAIL_APP_PASSWORD must be a Google **App Password** (16 chars, requires 2FA on
 * the account). A normal account password will not authenticate and Gmail will reject it.
 *
 *   GMAIL_USER=you@gmail.com
 *   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
 *   MAIL_FROM="TYIMS <you@gmail.com>"
 *
 * Gmail allows roughly 500 messages/day. That is fine at this volume but it is not a
 * transactional email service — if sending grows, move to a real provider.
 *
 * EVERY function here is best-effort and never throws. A mail failure must not roll back
 * or block a payout.
 */

let cached: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cached) return cached;

  const user = process.env.GMAIL_USER?.trim();
  // Google displays app passwords as "xxxx xxxx xxxx xxxx". Pasted verbatim that is 19
  // characters and Gmail rejects the login with a confusing "invalid credentials".
  // Strip whitespace so either form works.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    // Not configured — callers degrade to in-app notifications only.
    return null;
  }

  if (pass.length !== 16) {
    console.warn(
      `[mail] GMAIL_APP_PASSWORD is ${pass.length} characters after removing spaces; ` +
        "Google app passwords are 16. This is probably an account password, which Gmail SMTP will reject.",
    );
  }

  cached = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cached;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

type SendArgs = { to: string; subject: string; heading: string; body: string[]; footer?: string };

/** Send an email. Never throws — logs and returns false on failure. */
export async function sendMail(args: SendArgs): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mail] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping", {
      subject: args.subject,
    });
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.GMAIL_USER,
      to: args.to,
      subject: args.subject,
      text: [args.heading, "", ...args.body, "", args.footer ?? ""].join("\n"),
      html: renderHtml(args),
    });
    return true;
  } catch (err) {
    // Deliberately does not log the recipient or any message content.
    console.error("[mail] send failed", { subject: args.subject, err });
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml({ heading, body, footer }: SendArgs): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#131836">
  <h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(heading)}</h2>
  ${body.map((p) => `<p style="font-size:14px;line-height:1.6;color:#585d69;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
  <p style="font-size:12px;color:#9aa3b7;margin:0">
    ${escapeHtml(footer ?? "If this wasn't you, contact support immediately.")}
  </p>
</div>`.trim();
}

/* ── Security notices ─────────────────────────────────────────────────────── */

export async function mailPinChanged(to: string, name: string) {
  return sendMail({
    to,
    subject: "Your transaction PIN was changed",
    heading: `Hi ${name},`,
    body: [
      "The transaction PIN on your TYIMS instructor account was just changed.",
      "This PIN is required to withdraw earnings, so if you did not do this, your account may be compromised.",
    ],
    footer: "If this wasn't you, contact support immediately and change your password.",
  });
}

export async function mailBankAccountChanged(to: string, name: string, bankName: string, masked: string) {
  return sendMail({
    to,
    subject: "Your payout bank account was changed",
    heading: `Hi ${name},`,
    body: [
      `The bank account for your TYIMS payouts was changed to ${bankName} (${masked}).`,
      "All future withdrawals will go to this account.",
    ],
    footer: "If this wasn't you, contact support immediately.",
  });
}

export async function mailPayoutSent(to: string, name: string, amount: string, bankName: string) {
  return sendMail({
    to,
    subject: `${amount} is on its way to your bank`,
    heading: `Hi ${name},`,
    body: [
      `Your withdrawal of ${amount} has been sent to your ${bankName} account.`,
      "Most banks credit within minutes, though it can occasionally take up to 24 hours.",
    ],
    footer: "You can see all your withdrawals in your instructor dashboard.",
  });
}

export async function mailPayoutFailed(to: string, name: string, amount: string, reason: string) {
  return sendMail({
    to,
    subject: "Your withdrawal didn't go through",
    heading: `Hi ${name},`,
    body: [
      `Your withdrawal of ${amount} was not completed.`,
      `Reason: ${reason}`,
      "The money has been returned to your available balance, so nothing has been lost.",
    ],
    footer: "Check your bank details and try again from your dashboard.",
  });
}

/**
 * Verifies Gmail SMTP end to end.
 *
 *   npx tsx scripts/test-mail.ts              -> verify credentials only
 *   npx tsx scripts/test-mail.ts you@mail.com -> also send a real test email
 *
 * Never prints the app password.
 */
import "dotenv/config";
import nodemailer from "nodemailer";
import { isMailConfigured, sendMail } from "../lib/mail";

async function main() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  console.log("GMAIL_USER      :", user ?? "NOT SET");
  console.log("GMAIL_APP_PASSWORD:", pass ? `[${pass.length} chars after stripping spaces]` : "NOT SET");
  console.log("MAIL_FROM       :", process.env.MAIL_FROM ?? "(falls back to GMAIL_USER)");
  console.log("isMailConfigured:", isMailConfigured());
  console.log("");

  if (!user || !pass) {
    console.error("Cannot continue — credentials missing.");
    process.exit(1);
  }

  console.log("1. Verifying SMTP credentials with Gmail…");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  try {
    await transporter.verify();
    console.log("   OK — Gmail accepted the credentials.");
  } catch (e) {
    console.error("   FAILED —", (e as Error).message);
    console.error("");
    console.error("   Most common causes:");
    console.error("     • the value is the account password, not a 16-char App Password");
    console.error("     • 2-Step Verification is not enabled on the Google account");
    console.error("     • the App Password was revoked");
    process.exit(1);
  }

  const to = process.argv[2];
  if (!to) {
    console.log("");
    console.log("No recipient given — skipping the send test.");
    console.log("Run: npx tsx scripts/test-mail.ts your@email.com");
    process.exit(0);
  }

  console.log("");
  console.log(`2. Sending a test email to ${to} …`);
  const sent = await sendMail({
    to,
    subject: "TYIMS — payout email test",
    heading: "Email is working",
    body: [
      "This is a test from your TYIMS instructor payout system.",
      "If you received this, PIN changes, bank account changes and payout notifications will reach instructors.",
    ],
    footer: "You can safely ignore this message.",
  });
  console.log(sent ? "   OK — sent." : "   FAILED — check the logs above.");
  process.exit(sent ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});

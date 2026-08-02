/**
 * Confirms that programmatic transfers actually work — i.e. that "Transfers OTP" is
 * disabled in the Paystack Dashboard.
 *
 *   npx tsx scripts/test-paystack-transfer.ts
 *
 * REFUSES TO RUN ON LIVE KEYS. Test mode only, and it sends the smallest possible amount
 * to Paystack's designated test account.
 *
 * What to look for:
 *   status "success" / "pending" / "otp"
 *     success|pending -> OTP is off, automatic payouts will work
 *     otp             -> OTP is still ON; auto-approval cannot complete
 */
import "dotenv/config";
import {
  isTestMode,
  createTransferRecipient,
  initiateTransfer,
  getPlatformBalanceKobo,
} from "../lib/payouts/paystack-transfers";
import { formatKobo } from "../lib/revenue";
import { nanoid } from "nanoid";

async function main() {
  if (!isTestMode()) {
    console.error("REFUSING TO RUN: PAYSTACK_SECRET_KEY is a LIVE key.");
    console.error("This script initiates a real transfer. Switch to test keys first.");
    process.exit(1);
  }

  console.log("Mode: TEST (safe)\n");

  const balance = await getPlatformBalanceKobo();
  console.log("Platform balance:", balance === null ? "unavailable" : formatKobo(balance));

  console.log("\n1. Creating a transfer recipient (Paystack test account)…");
  // Bank code 057 (Zenith) with 0000000000 resolves to "Test" in Paystack test mode and,
  // unlike code 001, is present in the live /bank list so createTransferRecipient accepts it.
  const recipient = await createTransferRecipient({
    name: "Test",
    accountNumber: "0000000000",
    bankCode: "057",
  });
  if (!recipient.ok) {
    console.error("   FAILED —", recipient.message);
    process.exit(1);
  }
  console.log("   OK — recipient created.");

  const reference = `TESTPO-${Date.now()}-${nanoid(6)}`;
  console.log(`\n2. Initiating a ₦100 transfer (reference ${reference})…`);
  const transfer = await initiateTransfer({
    amountKobo: 10_000, // ₦100
    recipientCode: recipient.recipientCode,
    reference,
    reason: "TYIMS payout pipeline test",
  });

  if (!transfer.ok) {
    console.error("   FAILED —", transfer.message);
    if (/otp/i.test(transfer.message)) {
      console.error("\n   >>> Transfers OTP is still ENABLED.");
      console.error("   >>> Paystack Dashboard -> Settings -> Preferences -> disable Transfers OTP.");
    }
    if (/balance/i.test(transfer.message)) {
      console.error("\n   >>> Test balance is too low. Fund it from the Paystack test dashboard.");
    }
    process.exit(1);
  }

  console.log("   OK — Paystack accepted the transfer.");
  console.log("   status       :", transfer.result.status);
  console.log("   transfer_code:", transfer.result.transferCode);

  if (transfer.result.status === "otp") {
    console.log("\n>>> OTP IS STILL ENABLED — automatic payouts will stall waiting for a code.");
    console.log(">>> Paystack Dashboard -> Settings -> Preferences -> disable Transfers OTP.");
    process.exit(1);
  }

  console.log("\n>>> OTP is disabled. Programmatic payouts will complete without human input.");
  console.log(">>> The final outcome arrives on the transfer.success / transfer.failed webhook.");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});

import { db } from "@/lib/db";
import { payouts, instructorPayoutAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { initiateTransfer, getPlatformBalanceKobo } from "./paystack-transfers";
import { settlePayout } from "./withdraw";
import { formatKobo } from "@/lib/revenue";

/**
 * Sends an approved payout to Paystack.
 *
 * Separated from `createWithdrawal` on purpose: creating the request (which debits the
 * ledger) and dispatching it (which talks to a third party) must be able to fail
 * independently. A network error here leaves the payout PROCESSING with the money still
 * reserved — recoverable — rather than losing the record of what was owed.
 *
 * Idempotency comes from `payout.reference`, which is unique in our database and sent to
 * Paystack as the transfer reference. A duplicate dispatch is rejected by Paystack rather
 * than paying twice.
 */
export async function dispatchPayout(payoutId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId));

  if (!payout) return { ok: false, message: "Payout not found." };

  // Only dispatch things that are waiting to be dispatched.
  if (payout.status !== "PROCESSING" && payout.status !== "REQUESTED") {
    return { ok: false, message: `Payout is already ${payout.status}.` };
  }

  const [account] = await db
    .select()
    .from(instructorPayoutAccounts)
    .where(eq(instructorPayoutAccounts.instructorId, payout.instructorId));

  if (!account?.recipientCode) {
    return { ok: false, message: "No verified Paystack recipient for this instructor." };
  }

  // Refuse rather than let Paystack bounce it — a failed transfer costs a round trip and
  // leaves a confusing FAILED record.
  const platformBalance = await getPlatformBalanceKobo();
  if (platformBalance != null && platformBalance < payout.netKobo) {
    return {
      ok: false,
      message: `Insufficient platform balance. Need ${formatKobo(payout.netKobo)}, have ${formatKobo(platformBalance)}.`,
    };
  }

  await db
    .update(payouts)
    .set({ status: "PROCESSING", processedAt: new Date() })
    .where(and(eq(payouts.id, payoutId), eq(payouts.status, "REQUESTED")));

  const result = await initiateTransfer({
    // netKobo — the instructor bears the fee, so we send what they actually receive.
    amountKobo: payout.netKobo,
    recipientCode: account.recipientCode,
    reference: payout.reference,
    reason: "TYIMS instructor payout",
  });

  if (!result.ok) {
    // Paystack rejected it outright, so no money moved — settle as FAILED, which returns
    // the reserved balance to the instructor.
    await settlePayout({
      payoutId,
      outcome: "FAILED",
      failureReason: result.message,
    });
    return { ok: false, message: result.message };
  }

  await db
    .update(payouts)
    .set({ paystackTransferCode: result.result.transferCode })
    .where(eq(payouts.id, payoutId));

  // NOT success yet — Paystack has only queued it. The webhook decides.
  return { ok: true };
}

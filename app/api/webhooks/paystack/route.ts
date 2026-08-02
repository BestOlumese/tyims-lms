import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, enrollments, payouts } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/paystack";
import { notifyPurchaseSucceeded, notifyPayoutOutcome } from "@/lib/notifications";
import { creditTransaction } from "@/lib/payouts/ledger";
import { settlePayout } from "@/lib/payouts/withdraw";

// Must read raw body for HMAC verification — do NOT parse as JSON first
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // 1. Reject if signature invalid — stops forged events dead
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; data: Record<string, any> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2a. Transfer events — the outcome of an instructor payout.
  // Handled before the charge branch because they are a different money direction.
  if (event.event?.startsWith("transfer.")) {
    return await handleTransferEvent(event.event, event.data);
  }

  // 2b. Only successful charges beyond this point
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference = event.data?.reference as string | undefined;
  if (!reference) return NextResponse.json({ received: true });

  // 3. Find our transaction record
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.paystackReference, reference));

  if (!txn) {
    // Not our transaction — ignore silently
    return NextResponse.json({ received: true });
  }

  // 4. Idempotency — already processed, skip
  if (txn.status === "success") {
    return NextResponse.json({ received: true });
  }

  // 5. Verify amount matches to prevent amount manipulation
  const webhookAmountKobo = event.data?.amount as number | undefined;
  if (webhookAmountKobo !== txn.amount) {
    console.error(`[Paystack Webhook] Amount mismatch for ${reference}: expected ${txn.amount}, got ${webhookAmountKobo}`);
    return NextResponse.json({ received: true });
  }

  // 6. Enroll in courses (onConflictDoNothing = safe to call multiple times)
  if (txn.courseIds.length > 0) {
    await db.insert(enrollments).values(
      txn.courseIds.map((courseId) => ({
        userId: txn.userId,
        courseId,
        accessType: "PURCHASE" as const,
      }))
    ).onConflictDoNothing();
  }

  // 7. Mark transaction success.
  // Conditional on it not already being success, so this is an atomic pending → success
  // transition. student.verifyPayment races this webhook (the buyer returning to the site
  // can verify before Paystack calls us); whichever gets here first flips the row, and
  // only that one gets a row back to notify from.
  const flipped = await db.update(transactions)
    .set({ status: "success", verifiedAt: new Date() })
    .where(and(eq(transactions.id, txn.id), ne(transactions.status, "success")))
    .returning({ id: transactions.id });

  if (flipped.length > 0) {
    // 8. Credit the instructors' ledgers. This is money, so it happens before
    // notifications and its failure is loud — but creditTransaction is itself idempotent,
    // so a Paystack retry cannot double-credit.
    await creditTransaction(txn.id);

    // 9. Notifications — side effect only, and only for the path that won the race.
    await notifyPurchaseSucceeded(txn.id, txn.userId, txn.amount);
  }

  return NextResponse.json({ received: true });
}

/**
 * Outcome of an instructor payout.
 *
 * A transfer is only ever finalised here — never at request time — because Paystack only
 * queues it when we call POST /transfer.
 *
 * We match on OUR reference (payout.reference), which is unique in our database, rather
 * than on Paystack's transfer_code. settlePayout is idempotent and ignores payouts that
 * are already terminal, so redelivered webhooks are harmless.
 *
 *   transfer.success   money arrived    -> reserved becomes withdrawn
 *   transfer.failed    never left       -> reserved returns to available
 *   transfer.reversed  came back        -> reserved returns to available
 */
async function handleTransferEvent(
  eventName: string,
  data: Record<string, any>,
): Promise<NextResponse> {
  const reference = data?.reference as string | undefined;
  if (!reference) return NextResponse.json({ received: true });

  const [payout] = await db
    .select({ id: payouts.id, instructorId: payouts.instructorId, netKobo: payouts.netKobo })
    .from(payouts)
    .where(eq(payouts.reference, reference));

  // Not one of ours (or a transfer made manually from the Paystack dashboard).
  if (!payout) return NextResponse.json({ received: true });

  const outcome =
    eventName === "transfer.success"
      ? "SUCCESS"
      : eventName === "transfer.reversed"
        ? "REVERSED"
        : "FAILED";

  const { changed } = await settlePayout({
    payoutId: payout.id,
    outcome,
    failureReason:
      outcome === "SUCCESS"
        ? undefined
        : (data?.reason as string) || (data?.message as string) || `Transfer ${outcome.toLowerCase()}`,
    transferCode: data?.transfer_code as string | undefined,
  });

  // Only notify on the transition, so a redelivered webhook doesn't re-alert anyone.
  if (changed) {
    await notifyPayoutOutcome({
      instructorId: payout.instructorId,
      outcome,
      netKobo: payout.netKobo,
      reference,
    });
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, enrollments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/paystack";

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

  // 2. Only handle successful charges
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

  // 7. Mark transaction success
  await db.update(transactions)
    .set({ status: "success", verifiedAt: new Date() })
    .where(eq(transactions.id, txn.id));

  return NextResponse.json({ received: true });
}

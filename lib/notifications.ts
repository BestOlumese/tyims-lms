import { db } from "@/lib/db";
import {
  notifications,
  users,
  transactionItems,
  courses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatKobo } from "@/lib/revenue";
import { mailPayoutSent, mailPayoutFailed } from "@/lib/mail";

/**
 * Notification writing. Every notification in the app is created through here so the
 * shape stays consistent and emitting one can never take down the flow that triggered it.
 *
 * Rule: a notification is a side effect, never a precondition. If writing one fails, the
 * payment/review/application it describes must still succeed — hence the swallowed errors.
 * They're logged, not thrown.
 */

export type NotificationType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "INSTRUCTOR_APPLICATION"
  | "COURSE_PURCHASED"
  | "COURSE_REVIEWED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "PAYOUT_QUEUED"
  | "PAYOUT_SENT"
  | "PAYOUT_FAILED"
  | "BANK_ACCOUNT_REVIEW";

export type NotifyInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
};

/** Create one notification. Never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actorId: input.actorId ?? null,
    });
  } catch (err) {
    console.error("[notifications] failed to create notification", {
      type: input.type,
      recipientId: input.recipientId,
      err,
    });
  }
}

/** Create the same notification for several recipients. Never throws. */
export async function notifyMany(
  recipientIds: string[],
  input: Omit<NotifyInput, "recipientId">,
): Promise<void> {
  const unique = [...new Set(recipientIds)].filter(Boolean);
  if (unique.length === 0) return;

  try {
    await db.insert(notifications).values(
      unique.map((recipientId) => ({
        recipientId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
      })),
    );
  } catch (err) {
    console.error("[notifications] failed to create notifications", {
      type: input.type,
      count: unique.length,
      err,
    });
  }
}

/** Every admin's id — the audience for platform-level events. */
export async function getAdminIds(): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "ADMIN"));
    return rows.map((r) => r.id);
  } catch (err) {
    console.error("[notifications] failed to load admin ids", err);
    return [];
  }
}

/** Notify all admins at once. Never throws. */
export async function notifyAdmins(
  input: Omit<NotifyInput, "recipientId">,
): Promise<void> {
  const adminIds = await getAdminIds();
  await notifyMany(adminIds, input);
}

/**
 * Fan-out for a completed purchase: tell admins money arrived, and tell each affected
 * instructor what they earned.
 *
 * Shared by BOTH success paths — the Paystack webhook and student.verifyPayment. The
 * webhook may never fire (it isn't configured in local dev, and needs a public URL), so
 * verifyPayment cannot be left without it.
 *
 * Callers must only invoke this once per transaction. Both paths guarantee that by
 * transitioning pending → success with a conditional UPDATE and calling this only when
 * that update actually changed a row.
 */
export async function notifyPurchaseSucceeded(
  transactionId: string,
  buyerId: string,
  amountKobo: number,
): Promise<void> {
  try {
    const [buyer] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, buyerId));
    const buyerLabel = buyer?.name || buyer?.email || "A student";

    const items = await db
      .select({
        instructorId: transactionItems.instructorId,
        courseTitle: courses.title,
        earningKobo: transactionItems.instructorEarningKobo,
      })
      .from(transactionItems)
      .leftJoin(courses, eq(courses.id, transactionItems.courseId))
      .where(eq(transactionItems.transactionId, transactionId));

    await notifyAdmins({
      type: "PAYMENT_SUCCEEDED",
      title: `Payment received — ${formatKobo(amountKobo)}`,
      body: `${buyerLabel} purchased ${items.length} course${items.length === 1 ? "" : "s"}.`,
      link: "/admin/revenue",
      entityType: "transaction",
      entityId: transactionId,
      actorId: buyerId,
    });

    // One notification per instructor, covering only their own line items, so a basket
    // spanning two instructors never leaks one's sales to the other.
    const byInstructor = new Map<string, typeof items>();
    for (const item of items) {
      const list = byInstructor.get(item.instructorId) ?? [];
      list.push(item);
      byInstructor.set(item.instructorId, list);
    }

    for (const [instructorId, lines] of byInstructor) {
      const earned = lines.reduce((sum, l) => sum + l.earningKobo, 0);
      const titles = lines.map((l) => l.courseTitle).filter(Boolean).join(", ");
      await notify({
        recipientId: instructorId,
        type: "COURSE_PURCHASED",
        title: `${buyerLabel} bought ${lines.length === 1 ? "your course" : `${lines.length} of your courses`}`,
        body: `${titles} — you earned ${formatKobo(earned)}.`,
        link: "/instructor/revenue",
        entityType: "transaction",
        entityId: transactionId,
        actorId: buyerId,
      });
    }
  } catch (err) {
    console.error("[notifications] purchase fan-out failed", { transactionId, err });
  }
}

/**
 * Tell an instructor how their withdrawal ended.
 *
 * Called only on an actual state transition (see settlePayout), so a redelivered webhook
 * never re-notifies. Best-effort — a notification failure must not affect the payout.
 */
export async function notifyPayoutOutcome(params: {
  instructorId: string;
  outcome: "SUCCESS" | "FAILED" | "REVERSED";
  netKobo: number;
  reference: string;
}): Promise<void> {
  const { instructorId, outcome, netKobo, reference } = params;

  // Look up the recipient once so we can also email them. Email matters here: an
  // attacker holding a session would otherwise be the only one who ever sees this.
  const [instructor] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, instructorId));

  if (outcome === "SUCCESS") {
    await notify({
      recipientId: instructorId,
      type: "PAYOUT_SENT",
      title: `${formatKobo(netKobo)} is on its way to your bank`,
      body: "Most banks credit within minutes, though it can take up to 24 hours.",
      link: "/instructor/withdraw",
      entityType: "payout",
      entityId: reference,
    });
    if (instructor?.email) {
      await mailPayoutSent(instructor.email, instructor.name ?? "there", formatKobo(netKobo), "bank");
    }
    return;
  }

  await notify({
    recipientId: instructorId,
    type: "PAYOUT_FAILED",
    title: `Your withdrawal of ${formatKobo(netKobo)} didn't go through`,
    body: "The money has been returned to your available balance. Check your bank details and try again.",
    link: "/instructor/withdraw",
    entityType: "payout",
    entityId: reference,
  });

  if (instructor?.email) {
    await mailPayoutFailed(
      instructor.email,
      instructor.name ?? "there",
      formatKobo(netKobo),
      outcome === "REVERSED" ? "The transfer was reversed by the bank." : "The transfer could not be completed.",
    );
  }

  // Admins should know when money fails to move.
  await notifyAdmins({
    type: "PAYOUT_FAILED",
    title: `Instructor payout ${outcome.toLowerCase()}`,
    body: `${formatKobo(netKobo)} — reference ${reference}. Funds returned to the instructor's balance.`,
    link: "/admin/payouts",
    entityType: "payout",
    entityId: reference,
  });
}

/** Tell admins a withdrawal is waiting for approval. */
export async function notifyPayoutQueued(params: {
  instructorName: string;
  amountKobo: number;
  payoutId: string;
}): Promise<void> {
  await notifyAdmins({
    type: "PAYOUT_QUEUED",
    title: `Withdrawal awaiting approval — ${formatKobo(params.amountKobo)}`,
    body: `${params.instructorName} requested a withdrawal above the auto-approve limit.`,
    link: "/admin/payouts",
    entityType: "payout",
    entityId: params.payoutId,
  });
}

/** Tell admins a bank account needs a human because the name didn't match. */
export async function notifyBankAccountReview(params: {
  instructorId: string;
  instructorName: string;
  accountName: string;
  score: number;
}): Promise<void> {
  await notifyAdmins({
    type: "BANK_ACCOUNT_REVIEW",
    title: "Bank account needs review",
    body: `${params.instructorName} added an account held by "${params.accountName}" (name match ${Math.round(params.score * 100)}%).`,
    link: "/admin/payouts",
    entityType: "user",
    entityId: params.instructorId,
  });
}

/** Tell admins a payment did not go through. Never throws. */
export async function notifyPaymentFailed(
  transactionId: string,
  buyerId: string,
  amountKobo: number,
  reason: string,
): Promise<void> {
  try {
    const [buyer] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, buyerId));

    await notifyAdmins({
      type: "PAYMENT_FAILED",
      title: `Payment failed — ${formatKobo(amountKobo)}`,
      body: `${buyer?.name || buyer?.email || "A student"}: ${reason}`,
      link: "/admin/revenue",
      entityType: "transaction",
      entityId: transactionId,
      actorId: buyerId,
    });
  } catch (err) {
    console.error("[notifications] payment-failed notice failed", { transactionId, err });
  }
}

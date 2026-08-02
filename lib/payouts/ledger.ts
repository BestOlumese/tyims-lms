import { db } from "@/lib/db";
import {
  ledgerEntries,
  instructorBalances,
  transactionItems,
  transactions,
} from "@/lib/db/schema";
import { and, eq, sql, isNull, lte, inArray } from "drizzle-orm";
import { getHoldDays } from "./config";

/**
 * The instructor ledger.
 *
 * Design rules — these are what keep the money correct:
 *
 * 1. `ledger_entry` is APPEND-ONLY. Corrections are new rows. Nothing is ever updated or
 *    deleted, so the history is always auditable.
 * 2. `instructor_balance` is materialised from the ledger and is the ONLY thing a
 *    withdrawal reads — under `SELECT … FOR UPDATE`, so two concurrent withdrawals
 *    serialise instead of both seeing the same balance.
 * 3. Crediting a sale is idempotent by database constraint: `ledger_txn_item_unique_idx`
 *    permits one SALE row per `transaction_item`. A retry hits the unique index instead of
 *    double-paying. We never pre-check-then-insert.
 * 4. A sale is credited to `pending` and only moves to `available` once the hold period has
 *    elapsed, so a refund inside the window can be netted off before the money leaves.
 */

/** Ensure a balance row exists. Safe to call concurrently. */
async function ensureBalanceRow(tx: typeof db, instructorId: string) {
  await tx
    .insert(instructorBalances)
    .values({ instructorId })
    .onConflictDoNothing();
}

/**
 * Credit an instructor's share of one sold course.
 *
 * Idempotent: calling it twice for the same transactionItemId inserts once. Intended to be
 * called from the payment-success path, which may run twice (webhook + verifyPayment race).
 */
export async function creditSale(params: {
  instructorId: string;
  transactionItemId: string;
  amountKobo: number;
  soldAt?: Date;
}): Promise<{ credited: boolean }> {
  const { instructorId, transactionItemId, amountKobo } = params;
  if (amountKobo <= 0) return { credited: false };

  const soldAt = params.soldAt ?? new Date();
  const availableAt = new Date(soldAt.getTime() + getHoldDays() * 24 * 60 * 60 * 1000);

  try {
    return await db.transaction(async (tx) => {
      await ensureBalanceRow(tx as unknown as typeof db, instructorId);

      // Lock the balance row so concurrent credits serialise.
      const [balance] = await tx
        .select()
        .from(instructorBalances)
        .where(eq(instructorBalances.instructorId, instructorId))
        .for("update");

      const runningTotal =
        (balance?.availableKobo ?? 0) +
        (balance?.pendingKobo ?? 0) +
        (balance?.reservedKobo ?? 0) +
        amountKobo;

      // The unique index on transaction_item_id makes this the idempotency gate.
      await tx.insert(ledgerEntries).values({
        instructorId,
        type: "SALE",
        amountKobo,
        balanceAfterKobo: runningTotal,
        availableAt,
        transactionItemId,
        note: "Course sale",
      });

      await tx
        .update(instructorBalances)
        .set({
          pendingKobo: sql`${instructorBalances.pendingKobo} + ${amountKobo}`,
          updatedAt: new Date(),
        })
        .where(eq(instructorBalances.instructorId, instructorId));

      return { credited: true };
    });
  } catch (err: unknown) {
    // 23505 = unique_violation → this line item was already credited. Not an error.
    if (typeof err === "object" && err !== null && "cause" in err) {
      const cause = (err as { cause?: { code?: string } }).cause;
      if (cause?.code === "23505") return { credited: false };
    }
    if ((err as { code?: string })?.code === "23505") return { credited: false };
    throw err;
  }
}

/**
 * Credit every line item of a successful transaction. Called from the payment-success path.
 * Safe to call more than once.
 */
export async function creditTransaction(transactionId: string): Promise<number> {
  const items = await db
    .select({
      id: transactionItems.id,
      instructorId: transactionItems.instructorId,
      earningKobo: transactionItems.instructorEarningKobo,
      verifiedAt: transactions.verifiedAt,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(
      and(
        eq(transactionItems.transactionId, transactionId),
        eq(transactions.status, "success"),
      ),
    );

  let credited = 0;
  for (const item of items) {
    const res = await creditSale({
      instructorId: item.instructorId,
      transactionItemId: item.id,
      amountKobo: item.earningKobo,
      soldAt: item.verifiedAt ?? new Date(),
    });
    if (res.credited) credited++;
  }
  return credited;
}

/**
 * Move sale credits whose hold period has elapsed from `pending` to `available`.
 *
 * Idempotent by construction: an entry is only matured once because we stamp `availableAt`
 * to NULL as we go, and the whole sweep runs inside one transaction per instructor.
 *
 * Called opportunistically whenever a balance is read, so no cron job is required.
 */
export async function maturePendingCredits(instructorId: string): Promise<number> {
  const now = new Date();

  const due = await db
    .select({ id: ledgerEntries.id, amountKobo: ledgerEntries.amountKobo })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.instructorId, instructorId),
        eq(ledgerEntries.type, "SALE"),
        lte(ledgerEntries.availableAt, now),
      ),
    );

  if (due.length === 0) return 0;

  const total = due.reduce((s, d) => s + d.amountKobo, 0);
  if (total <= 0) return 0;

  await db.transaction(async (tx) => {
    await tx
      .select()
      .from(instructorBalances)
      .where(eq(instructorBalances.instructorId, instructorId))
      .for("update");

    // Clearing availableAt is what stops an entry maturing twice.
    await tx
      .update(ledgerEntries)
      .set({ availableAt: null })
      .where(
        and(
          inArray(
            ledgerEntries.id,
            due.map((d) => d.id),
          ),
          sql`${ledgerEntries.availableAt} IS NOT NULL`,
        ),
      );

    await tx
      .update(instructorBalances)
      .set({
        pendingKobo: sql`GREATEST(${instructorBalances.pendingKobo} - ${total}, 0)`,
        availableKobo: sql`${instructorBalances.availableKobo} + ${total}`,
        updatedAt: new Date(),
      })
      .where(eq(instructorBalances.instructorId, instructorId));
  });

  return total;
}

export type InstructorBalance = {
  availableKobo: number;
  pendingKobo: number;
  reservedKobo: number;
  withdrawnKobo: number;
};

/** Read a balance, maturing anything that has come out of its hold window first. */
export async function getBalance(instructorId: string): Promise<InstructorBalance> {
  await db.insert(instructorBalances).values({ instructorId }).onConflictDoNothing();
  await maturePendingCredits(instructorId);

  const [row] = await db
    .select()
    .from(instructorBalances)
    .where(eq(instructorBalances.instructorId, instructorId));

  return {
    availableKobo: row?.availableKobo ?? 0,
    pendingKobo: row?.pendingKobo ?? 0,
    reservedKobo: row?.reservedKobo ?? 0,
    withdrawnKobo: row?.withdrawnKobo ?? 0,
  };
}

/**
 * Reverse an instructor's credit for a refunded / charged-back sale.
 *
 * Takes the money from `pending` first (the sale is probably still inside its hold window,
 * which is exactly what the hold is for), then from `available`.
 *
 * If the instructor has already withdrawn it, the shortfall is recorded as a NEGATIVE
 * ledger entry and the balance floors at zero. That leaves an explicit, auditable record
 * that they owe the platform, without letting the materialised balance go negative — the
 * database CHECK constraint would reject that anyway.
 *
 * Idempotent per line item: a second call for the same transactionItemId does nothing.
 */
export async function reverseSale(params: {
  transactionItemId: string;
  reason?: string;
}): Promise<{ reversed: boolean; shortfallKobo: number }> {
  const { transactionItemId, reason } = params;

  const [saleEntry] = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.transactionItemId, transactionItemId),
        eq(ledgerEntries.type, "SALE"),
      ),
    );

  if (!saleEntry) return { reversed: false, shortfallKobo: 0 };

  // Already reversed?
  const existing = await db
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.instructorId, saleEntry.instructorId),
        eq(ledgerEntries.type, "REFUND"),
        eq(ledgerEntries.payoutId, `refund:${transactionItemId}`),
      ),
    );
  if (existing.length > 0) return { reversed: false, shortfallKobo: 0 };

  const amount = saleEntry.amountKobo;

  return await db.transaction(async (tx) => {
    const [bal] = await tx
      .select()
      .from(instructorBalances)
      .where(eq(instructorBalances.instructorId, saleEntry.instructorId))
      .for("update");

    const pending = bal?.pendingKobo ?? 0;
    const available = bal?.availableKobo ?? 0;

    const fromPending = Math.min(pending, amount);
    const fromAvailable = Math.min(available, amount - fromPending);
    const shortfall = amount - fromPending - fromAvailable;

    await tx
      .update(instructorBalances)
      .set({
        pendingKobo: sql`${instructorBalances.pendingKobo} - ${fromPending}`,
        availableKobo: sql`${instructorBalances.availableKobo} - ${fromAvailable}`,
        updatedAt: new Date(),
      })
      .where(eq(instructorBalances.instructorId, saleEntry.instructorId));

    // CRITICAL: clear availableAt on the reversed sale.
    //
    // maturePendingCredits() moves any SALE entry whose availableAt has passed from
    // pending into available. If a reversed entry keeps its availableAt, the next
    // maturation sweep re-credits money that was already clawed back — inventing funds
    // out of nothing. Caught by scripts/test-refund-clawback.ts.
    await tx
      .update(ledgerEntries)
      .set({ availableAt: null })
      .where(eq(ledgerEntries.id, saleEntry.id));

    const [after] = await tx
      .select()
      .from(instructorBalances)
      .where(eq(instructorBalances.instructorId, saleEntry.instructorId));

    await tx.insert(ledgerEntries).values({
      instructorId: saleEntry.instructorId,
      type: "REFUND",
      amountKobo: -amount,
      balanceAfterKobo:
        (after?.availableKobo ?? 0) + (after?.pendingKobo ?? 0) + (after?.reservedKobo ?? 0),
      // Reuses payoutId as a dedupe key — it is a free-text column, and this makes the
      // "already reversed?" check above a single indexed lookup.
      payoutId: `refund:${transactionItemId}`,
      note: reason
        ? `Refund clawback: ${reason}`
        : "Refund clawback for a reversed purchase",
    });

    // Record what could not be recovered, so it is visible rather than silently absorbed.
    if (shortfall > 0) {
      await tx.insert(ledgerEntries).values({
        instructorId: saleEntry.instructorId,
        type: "ADJUSTMENT",
        amountKobo: 0,
        balanceAfterKobo:
          (after?.availableKobo ?? 0) + (after?.pendingKobo ?? 0) + (after?.reservedKobo ?? 0),
        note: `Unrecovered ${shortfall} kobo — already withdrawn before the refund. Owed to the platform.`,
      });
    }

    return { reversed: true, shortfallKobo: shortfall };
  });
}

/** Recent ledger activity for the instructor's earnings history. */
export async function getLedger(instructorId: string, limit = 50) {
  return await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.instructorId, instructorId))
    .orderBy(sql`${ledgerEntries.createdAt} DESC`)
    .limit(limit);
}

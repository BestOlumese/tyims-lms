import { db } from "@/lib/db";
import {
  users,
  payouts,
  ledgerEntries,
  instructorBalances,
  instructorPayoutAccounts,
  transactionItems,
  transactions,
} from "@/lib/db/schema";
import { and, eq, sql, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getMinPayoutKobo,
  getAutoApproveMaxKobo,
  calcPayoutFeeKobo,
} from "./config";
import { getBalance, maturePendingCredits } from "./ledger";
import { verifyTransactionPin } from "./pin";
import { maskAccountNumber } from "./paystack-transfers";

/**
 * Withdrawal request handling.
 *
 * THE CRITICAL INVARIANT: the balance check and the debit happen inside ONE database
 * transaction, with the instructor's balance row locked (`SELECT … FOR UPDATE`). Two
 * concurrent withdrawal requests therefore serialise — the second sees the balance the
 * first already reduced, instead of both reading the same number and both succeeding.
 *
 * Money is moved from `available` to `reserved` at request time, not at transfer time.
 * That way an in-flight payout cannot be spent twice even if Paystack is slow, and a
 * failure/reversal simply moves it back.
 */

export type EligibilityReason =
  | "NOT_INSTRUCTOR"
  | "EMAIL_UNVERIFIED"
  | "NO_BANK_ACCOUNT"
  | "BANK_UNVERIFIED"
  | "NO_PIN"
  | "NO_SALES"
  | "PAYOUT_IN_FLIGHT";

export type Eligibility = {
  eligible: boolean;
  blockers: { reason: EligibilityReason; message: string; fixHref?: string }[];
};

/**
 * Every gate that must pass before an instructor can withdraw.
 * Checked server-side on each request — never trusted from the client.
 */
export async function checkEligibility(instructorId: string): Promise<Eligibility> {
  const blockers: Eligibility["blockers"] = [];

  const [user] = await db
    .select({
      role: users.role,
      emailVerified: users.emailVerified,
      pinHash: users.transactionPinHash,
    })
    .from(users)
    .where(eq(users.id, instructorId));

  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) {
    blockers.push({
      reason: "NOT_INSTRUCTOR",
      message: "Only approved instructors can withdraw earnings.",
    });
  }

  if (user && !user.emailVerified) {
    blockers.push({
      reason: "EMAIL_UNVERIFIED",
      message: "Verify your email address before withdrawing.",
      fixHref: "/instructor/settings",
    });
  }

  if (user && !user.pinHash) {
    blockers.push({
      reason: "NO_PIN",
      message: "Set a 6-digit transaction PIN before withdrawing.",
      fixHref: "/instructor/withdraw",
    });
  }

  const [account] = await db
    .select({ verifiedAt: instructorPayoutAccounts.verifiedAt })
    .from(instructorPayoutAccounts)
    .where(eq(instructorPayoutAccounts.instructorId, instructorId));

  if (!account) {
    blockers.push({
      reason: "NO_BANK_ACCOUNT",
      message: "Add the bank account you want to be paid into.",
      fixHref: "/instructor/withdraw",
    });
  } else if (!account.verifiedAt) {
    blockers.push({
      reason: "BANK_UNVERIFIED",
      message:
        "Your bank account is awaiting review because the account name didn't match your profile name.",
      fixHref: "/instructor/withdraw",
    });
  }

  // At least one completed sale — stops a fresh account being used purely to move money.
  const [sales] = await db
    .select({ value: count() })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(
      and(
        eq(transactionItems.instructorId, instructorId),
        eq(transactions.status, "success"),
      ),
    );

  if ((sales?.value ?? 0) === 0) {
    blockers.push({
      reason: "NO_SALES",
      message: "You need at least one completed sale before withdrawing.",
    });
  }

  // One payout at a time keeps reserved funds and reconciliation simple.
  const [inFlight] = await db
    .select({ value: count() })
    .from(payouts)
    .where(
      and(
        eq(payouts.instructorId, instructorId),
        sql`${payouts.status} IN ('REQUESTED', 'PROCESSING')`,
      ),
    );

  if ((inFlight?.value ?? 0) > 0) {
    blockers.push({
      reason: "PAYOUT_IN_FLIGHT",
      message: "You already have a withdrawal in progress. Wait for it to complete.",
    });
  }

  return { eligible: blockers.length === 0, blockers };
}

/** What the instructor will actually receive, shown before they confirm. */
export function quoteWithdrawal(amountKobo: number) {
  const feeKobo = calcPayoutFeeKobo(amountKobo);
  return {
    amountKobo,
    feeKobo,
    netKobo: amountKobo - feeKobo,
  };
}

export type CreateWithdrawalResult =
  | { ok: true; payoutId: string; reference: string; autoApproved: boolean; netKobo: number; feeKobo: number }
  | { ok: false; message: string; code?: string };

/**
 * Create a withdrawal request.
 *
 * Order matters and is deliberate:
 *   1. eligibility gates          — cheap, fail fast
 *   2. amount validation          — server recomputes; never trusts the client
 *   3. PIN verification           — before any money moves, and it consumes an attempt
 *   4. locked balance + debit     — one transaction, one locked row
 *
 * Returns `autoApproved` so the caller knows whether to dispatch to Paystack now or leave
 * it in the admin queue.
 */
export async function createWithdrawal(params: {
  instructorId: string;
  amountKobo: number;
  pin: string;
}): Promise<CreateWithdrawalResult> {
  const { instructorId, amountKobo, pin } = params;

  // 1. Gates
  const eligibility = await checkEligibility(instructorId);
  if (!eligibility.eligible) {
    return { ok: false, message: eligibility.blockers[0].message, code: eligibility.blockers[0].reason };
  }

  // 2. Amount — validated against policy and the real balance, never against a client value
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return { ok: false, message: "Enter a valid amount." };
  }

  const min = getMinPayoutKobo();
  if (amountKobo < min) {
    return {
      ok: false,
      message: `The minimum withdrawal is ₦${(min / 100).toLocaleString()}.`,
      code: "BELOW_MINIMUM",
    };
  }

  const fee = calcPayoutFeeKobo(amountKobo);
  if (amountKobo - fee <= 0) {
    return { ok: false, message: "That amount is too small after transfer fees." };
  }

  await maturePendingCredits(instructorId);
  const balance = await getBalance(instructorId);
  if (amountKobo > balance.availableKobo) {
    return {
      ok: false,
      message: "That's more than your available balance.",
      code: "INSUFFICIENT_FUNDS",
    };
  }

  // 3. PIN — after the cheap checks so a wrong amount doesn't burn a PIN attempt,
  //    but before anything is debited.
  const pinResult = await verifyTransactionPin(instructorId, pin);
  if (!pinResult.ok) {
    return { ok: false, message: pinResult.message, code: pinResult.reason };
  }

  const [account] = await db
    .select()
    .from(instructorPayoutAccounts)
    .where(eq(instructorPayoutAccounts.instructorId, instructorId));

  if (!account) return { ok: false, message: "No bank account on file." };

  const reference = `PO-${instructorId.slice(0, 6)}-${Date.now()}-${nanoid(8)}`;
  const netKobo = amountKobo - fee;
  const autoApproved = amountKobo <= getAutoApproveMaxKobo();

  try {
    const payoutId = await db.transaction(async (tx) => {
      // 4a. LOCK the balance row. Everything below is serialised per instructor.
      const [locked] = await tx
        .select()
        .from(instructorBalances)
        .where(eq(instructorBalances.instructorId, instructorId))
        .for("update");

      // 4b. Re-check INSIDE the lock. The value read before the lock may be stale — this
      //     is the check that actually prevents a double withdrawal.
      if (!locked || locked.availableKobo < amountKobo) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const [created] = await tx
        .insert(payouts)
        .values({
          instructorId,
          amountKobo,
          feeKobo: fee,
          netKobo,
          status: autoApproved ? "PROCESSING" : "REQUESTED",
          reference,
          bankName: account.bankName,
          accountNumberMasked: maskAccountNumber(account.accountNumber),
          accountName: account.accountName,
        })
        .returning({ id: payouts.id });

      // 4c. Move money out of `available` into `reserved` — it is now spoken for.
      await tx
        .update(instructorBalances)
        .set({
          availableKobo: sql`${instructorBalances.availableKobo} - ${amountKobo}`,
          reservedKobo: sql`${instructorBalances.reservedKobo} + ${amountKobo}`,
          updatedAt: new Date(),
        })
        .where(eq(instructorBalances.instructorId, instructorId));

      const remaining = locked.availableKobo - amountKobo + locked.pendingKobo + locked.reservedKobo + amountKobo;

      // 4d. Audit rows. Append-only.
      await tx.insert(ledgerEntries).values([
        {
          instructorId,
          type: "PAYOUT",
          amountKobo: -(amountKobo - fee),
          balanceAfterKobo: remaining - amountKobo,
          payoutId: created.id,
          note: `Withdrawal ${reference}`,
        },
        {
          instructorId,
          type: "PAYOUT_FEE",
          amountKobo: -fee,
          balanceAfterKobo: remaining - amountKobo,
          payoutId: created.id,
          note: "Transfer fee and stamp duty",
        },
      ]);

      return created.id;
    });

    return { ok: true, payoutId, reference, autoApproved, netKobo, feeKobo: fee };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return {
        ok: false,
        message: "That's more than your available balance.",
        code: "INSUFFICIENT_FUNDS",
      };
    }
    console.error("[payouts] createWithdrawal failed", { instructorId, err });
    return { ok: false, message: "Could not create the withdrawal. Please try again." };
  }
}

/**
 * Settle a payout that reached a terminal state.
 *
 * SUCCESS  → reserved money is gone for good, counted as withdrawn
 * FAILED / REVERSED → reserved money returns to available
 *
 * Idempotent: only acts when the payout is still in a non-terminal state, so duplicate
 * webhooks are harmless.
 */
export async function settlePayout(params: {
  payoutId: string;
  outcome: "SUCCESS" | "FAILED" | "REVERSED";
  failureReason?: string;
  transferCode?: string;
}): Promise<{ changed: boolean }> {
  const { payoutId, outcome, failureReason, transferCode } = params;

  return await db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.id, payoutId))
      .for("update");

    if (!payout) return { changed: false };
    // Already terminal — a repeat webhook must not move money again.
    if (["SUCCESS", "FAILED", "REVERSED", "CANCELLED"].includes(payout.status)) {
      return { changed: false };
    }

    await tx
      .update(payouts)
      .set({
        status: outcome,
        failureReason: failureReason ?? null,
        paystackTransferCode: transferCode ?? payout.paystackTransferCode,
        completedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));

    await tx
      .select()
      .from(instructorBalances)
      .where(eq(instructorBalances.instructorId, payout.instructorId))
      .for("update");

    if (outcome === "SUCCESS") {
      await tx
        .update(instructorBalances)
        .set({
          reservedKobo: sql`GREATEST(${instructorBalances.reservedKobo} - ${payout.amountKobo}, 0)`,
          withdrawnKobo: sql`${instructorBalances.withdrawnKobo} + ${payout.amountKobo}`,
          updatedAt: new Date(),
        })
        .where(eq(instructorBalances.instructorId, payout.instructorId));
    } else {
      // Money never left — return it, and record the reversal in the ledger.
      await tx
        .update(instructorBalances)
        .set({
          reservedKobo: sql`GREATEST(${instructorBalances.reservedKobo} - ${payout.amountKobo}, 0)`,
          availableKobo: sql`${instructorBalances.availableKobo} + ${payout.amountKobo}`,
          updatedAt: new Date(),
        })
        .where(eq(instructorBalances.instructorId, payout.instructorId));

      const [bal] = await tx
        .select()
        .from(instructorBalances)
        .where(eq(instructorBalances.instructorId, payout.instructorId));

      await tx.insert(ledgerEntries).values({
        instructorId: payout.instructorId,
        type: "PAYOUT_REVERSAL",
        amountKobo: payout.amountKobo,
        balanceAfterKobo:
          (bal?.availableKobo ?? 0) + (bal?.pendingKobo ?? 0) + (bal?.reservedKobo ?? 0),
        payoutId,
        note: failureReason ? `Reversed: ${failureReason}` : "Transfer reversed",
      });
    }

    return { changed: true };
  });
}

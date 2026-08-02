/**
 * PAYOUT SAFETY REGRESSION TEST — run this after ANY change to lib/payouts/*.
 *
 *   npx tsx scripts/test-payout-safety.ts
 *
 * Covers the ways a payout system loses money:
 *   A  PIN verification, retry counter, lockout
 *   B  withdrawal eligibility gates
 *   C  amount validation (minimum, balance, wrong PIN)
 *   D  FIVE CONCURRENT withdrawals of the whole balance -> exactly one must win
 *   E  settlement + duplicate webhook must not double-count
 *   F  a failed transfer must return the money to available
 *
 * Creates and removes its own throwaway instructor, so it is safe to run against a
 * database with real data. It never touches Paystack.
 */
import "dotenv/config";
import { db } from "../lib/db";
import {
  users,
  instructorBalances,
  instructorPayoutAccounts,
  payouts,
  ledgerEntries,
  transactionItems,
  transactions,
  courses,
  categories,
} from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { setTransactionPin, verifyTransactionPin, getPinStatus } from "../lib/payouts/pin";
import { createWithdrawal, settlePayout, checkEligibility } from "../lib/payouts/withdraw";
import { formatKobo } from "../lib/revenue";
import { nanoid } from "nanoid";

const TEST_ID = "test-payout-" + nanoid(8);
const PIN = "428913";
const REF = "TEST-" + TEST_ID;

let fails = 0;
function check(label: string, pass: boolean, extra = "") {
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!pass) fails++;
}

async function cleanup() {
  await db.delete(ledgerEntries).where(eq(ledgerEntries.instructorId, TEST_ID));
  await db.delete(payouts).where(eq(payouts.instructorId, TEST_ID));
  await db.delete(instructorPayoutAccounts).where(eq(instructorPayoutAccounts.instructorId, TEST_ID));
  await db.delete(instructorBalances).where(eq(instructorBalances.instructorId, TEST_ID));
  await db.delete(transactionItems).where(eq(transactionItems.instructorId, TEST_ID));
  await db.delete(transactions).where(eq(transactions.paystackReference, REF));
  await db.delete(courses).where(eq(courses.instructorId, TEST_ID));
  await db.delete(users).where(eq(users.id, TEST_ID));
}

async function balance() {
  const [b] = await db
    .select()
    .from(instructorBalances)
    .where(eq(instructorBalances.instructorId, TEST_ID));
  return b;
}

async function resetPinLock() {
  await db
    .update(users)
    .set({ pinFailedAttempts: 0, pinLockedUntil: null })
    .where(eq(users.id, TEST_ID));
}

async function main() {
  await cleanup();

  await db.insert(users).values({
    id: TEST_ID,
    name: "Test Payout User",
    email: TEST_ID + "@test.local",
    emailVerified: true,
    role: "INSTRUCTOR",
  });
  await db.insert(instructorPayoutAccounts).values({
    instructorId: TEST_ID,
    bankCode: "058",
    bankName: "GTBank",
    accountNumber: "0123456789",
    accountName: "TEST PAYOUT USER",
    nameMatchScore: 1,
    verifiedAt: new Date(),
  });
  await db.insert(instructorBalances).values({ instructorId: TEST_ID, availableKobo: 1_000_000 }); // 10,000 NGN

  const [cat] = await db.select().from(categories).limit(1);
  const [course] = await db
    .insert(courses)
    .values({
      instructorId: TEST_ID,
      categoryId: cat?.id ?? null,
      title: "Test payout course",
      price: 1000,
      status: "PUBLISHED",
    })
    .returning();
  const [txn] = await db
    .insert(transactions)
    .values({
      userId: TEST_ID,
      courseIds: [course.id],
      amount: 100000,
      serviceFee: 0,
      paystackReference: REF,
      status: "success",
      verifiedAt: new Date(),
    })
    .returning();
  await db.insert(transactionItems).values({
    transactionId: txn.id,
    courseId: course.id,
    instructorId: TEST_ID,
    unitPriceKobo: 100000,
    platformFeeKobo: 0,
    instructorEarningKobo: 100000,
  });

  console.log("TEST A - transaction PIN");
  await setTransactionPin(TEST_ID, PIN);
  check("correct PIN verifies", (await verifyTransactionPin(TEST_ID, PIN)).ok);
  const wrong = await verifyTransactionPin(TEST_ID, "000000");
  check("wrong PIN rejected", !wrong.ok);
  check(
    "retry counter decrements",
    !wrong.ok && (wrong as { retriesLeft?: number }).retriesLeft === 4,
    "retriesLeft=" + (wrong as { retriesLeft?: number }).retriesLeft,
  );
  for (let i = 0; i < 4; i++) await verifyTransactionPin(TEST_ID, "111111");
  const status = await getPinStatus(TEST_ID);
  check("locks out after 5 wrong attempts", status.isLocked);
  const duringLock = await verifyTransactionPin(TEST_ID, PIN);
  check(
    "correct PIN refused while locked",
    !duringLock.ok && (duringLock as { reason?: string }).reason === "LOCKED",
  );
  await resetPinLock();

  console.log("");
  console.log("TEST B - eligibility gates");
  check("eligible once every gate is satisfied", (await checkEligibility(TEST_ID)).eligible);

  console.log("");
  console.log("TEST C - amount validation");
  const tooSmall = await createWithdrawal({ instructorId: TEST_ID, amountKobo: 10_000, pin: PIN });
  check("rejects below minimum", !tooSmall.ok);
  const tooBig = await createWithdrawal({ instructorId: TEST_ID, amountKobo: 99_999_900, pin: PIN });
  check("rejects more than balance", !tooBig.ok);
  const badPin = await createWithdrawal({ instructorId: TEST_ID, amountKobo: 500_000, pin: "999999" });
  check("rejects wrong PIN", !badPin.ok);
  await resetPinLock();

  console.log("");
  console.log("TEST D - 5 CONCURRENT withdrawals of the full balance");
  const before = await balance();
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      createWithdrawal({ instructorId: TEST_ID, amountKobo: 1_000_000, pin: PIN }),
    ),
  );
  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok,
  ).length;
  const after = await balance();
  const payoutRows = await db.select().from(payouts).where(eq(payouts.instructorId, TEST_ID));
  check("exactly ONE withdrawal succeeded", succeeded === 1, "succeeded=" + succeeded);
  check("exactly ONE payout row", payoutRows.length === 1, "rows=" + payoutRows.length);
  check("available drained to zero", after.availableKobo === 0, formatKobo(after.availableKobo));
  check("reserved holds it", after.reservedKobo === 1_000_000, formatKobo(after.reservedKobo));
  check(
    "no money invented or lost",
    before.availableKobo === after.availableKobo + after.reservedKobo,
    formatKobo(before.availableKobo) + " -> " + formatKobo(after.availableKobo + after.reservedKobo),
  );

  console.log("");
  console.log("TEST E - settlement + duplicate webhook");
  const payoutId = payoutRows[0].id;
  const s1 = await settlePayout({ payoutId, outcome: "SUCCESS" });
  const afterSuccess = await balance();
  check("SUCCESS applied", s1.changed);
  check("reserved cleared", afterSuccess.reservedKobo === 0);
  check("withdrawn recorded", afterSuccess.withdrawnKobo === 1_000_000, formatKobo(afterSuccess.withdrawnKobo));
  const s2 = await settlePayout({ payoutId, outcome: "SUCCESS" });
  check("duplicate webhook is a no-op", !s2.changed);
  const afterDup = await balance();
  check("withdrawn not double-counted", afterDup.withdrawnKobo === 1_000_000, formatKobo(afterDup.withdrawnKobo));

  console.log("");
  console.log("TEST F - failed transfer returns the money");
  await db
    .update(instructorBalances)
    .set({ availableKobo: 800_000, reservedKobo: 0, withdrawnKobo: 0 })
    .where(eq(instructorBalances.instructorId, TEST_ID));
  const w2 = await createWithdrawal({ instructorId: TEST_ID, amountKobo: 800_000, pin: PIN });
  check("second withdrawal created", w2.ok);
  if (w2.ok) {
    await settlePayout({ payoutId: w2.payoutId, outcome: "FAILED", failureReason: "Test failure" });
    const afterFail = await balance();
    check("money returned to available", afterFail.availableKobo === 800_000, formatKobo(afterFail.availableKobo));
    check("reserved cleared", afterFail.reservedKobo === 0);
    check("not counted as withdrawn", afterFail.withdrawnKobo === 0);
  }

  await cleanup();
  console.log("");
  console.log(fails === 0 ? "ALL PAYOUT SAFETY TESTS PASSED" : fails + " CHECK(S) FAILED");
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERROR", e);
  await cleanup().catch(() => {});
  process.exit(1);
});

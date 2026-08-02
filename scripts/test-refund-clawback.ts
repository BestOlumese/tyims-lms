/**
 * REFUND CLAWBACK REGRESSION TEST.
 *
 *   npx tsx scripts/test-refund-clawback.ts
 *
 * Covers:
 *   1. refund while the credit is still PENDING (inside the hold window)
 *   2. refund after the credit has matured to AVAILABLE
 *   3. refund AFTER the instructor already withdrew — the hard case: the balance must not
 *      go negative, and the shortfall must be recorded rather than silently absorbed
 *   4. refunding twice must be a no-op
 *
 * Creates and removes its own throwaway instructor. Never contacts Paystack.
 */
import "dotenv/config";
import { db } from "../lib/db";
import {
  users,
  instructorBalances,
  ledgerEntries,
  transactionItems,
  transactions,
  courses,
  categories,
} from "../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { creditSale, reverseSale, getBalance } from "../lib/payouts/ledger";
import { formatKobo } from "../lib/revenue";
import { nanoid } from "nanoid";

const TEST_ID = "test-refund-" + nanoid(8);
const REF = "TESTREF-" + TEST_ID;

let fails = 0;
function check(label: string, pass: boolean, extra = "") {
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!pass) fails++;
}

async function cleanup() {
  await db.delete(ledgerEntries).where(eq(ledgerEntries.instructorId, TEST_ID));
  await db.delete(instructorBalances).where(eq(instructorBalances.instructorId, TEST_ID));
  await db.delete(transactionItems).where(eq(transactionItems.instructorId, TEST_ID));
  await db.delete(transactions).where(eq(transactions.paystackReference, REF));
  await db.delete(courses).where(eq(courses.instructorId, TEST_ID));
  await db.delete(users).where(eq(users.id, TEST_ID));
}

async function makeItem(amountKobo: number, courseId: string, txnId: string) {
  const [item] = await db
    .insert(transactionItems)
    .values({
      transactionId: txnId,
      courseId,
      instructorId: TEST_ID,
      unitPriceKobo: amountKobo,
      platformFeeKobo: 0,
      instructorEarningKobo: amountKobo,
    })
    .returning();
  return item;
}

async function main() {
  await cleanup();

  await db.insert(users).values({
    id: TEST_ID,
    name: "Refund Test User",
    email: TEST_ID + "@test.local",
    emailVerified: true,
    role: "INSTRUCTOR",
  });
  const [cat] = await db.select().from(categories).limit(1);
  const [course] = await db
    .insert(courses)
    .values({
      instructorId: TEST_ID,
      categoryId: cat?.id ?? null,
      title: "Refund test course",
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

  console.log("TEST 1 - refund while still PENDING (inside the hold window)");
  const item1 = await makeItem(500_000, course.id, txn.id); // 5,000 NGN
  await creditSale({
    instructorId: TEST_ID,
    transactionItemId: item1.id,
    amountKobo: 500_000,
    soldAt: new Date(), // now -> stays pending
  });
  let bal = await getBalance(TEST_ID);
  check("credited to pending", bal.pendingKobo === 500_000, formatKobo(bal.pendingKobo));
  const r1 = await reverseSale({ transactionItemId: item1.id, reason: "Customer refund" });
  bal = await getBalance(TEST_ID);
  check("reversed", r1.reversed);
  check("pending returned to zero", bal.pendingKobo === 0, formatKobo(bal.pendingKobo));
  check("no shortfall", r1.shortfallKobo === 0);

  console.log("");
  console.log("TEST 2 - refund after it matured to AVAILABLE");
  const item2 = await makeItem(800_000, course.id, txn.id);
  await creditSale({
    instructorId: TEST_ID,
    transactionItemId: item2.id,
    amountKobo: 800_000,
    soldAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago -> matures
  });
  bal = await getBalance(TEST_ID);
  check("credited and matured to available", bal.availableKobo === 800_000, formatKobo(bal.availableKobo));
  const r2 = await reverseSale({ transactionItemId: item2.id, reason: "Chargeback" });
  bal = await getBalance(TEST_ID);
  check("reversed", r2.reversed);
  check("available returned to zero", bal.availableKobo === 0, formatKobo(bal.availableKobo));
  check("no shortfall", r2.shortfallKobo === 0);

  console.log("");
  console.log("TEST 3 - refund AFTER the money was already withdrawn (the hard case)");
  const item3 = await makeItem(600_000, course.id, txn.id);
  await creditSale({
    instructorId: TEST_ID,
    transactionItemId: item3.id,
    amountKobo: 600_000,
    soldAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });
  // Mature it first — getBalance() runs the maturation sweep. Without this the credit is
  // still PENDING and the reversal would take it from there, which is not the case under test.
  bal = await getBalance(TEST_ID);
  check("matured to available before the simulated payout", bal.availableKobo === 600_000, formatKobo(bal.availableKobo));

  // Simulate it having been paid out already: available drained, counted as withdrawn.
  await db
    .update(instructorBalances)
    .set({ availableKobo: 0, pendingKobo: 0, withdrawnKobo: 600_000 })
    .where(eq(instructorBalances.instructorId, TEST_ID));

  const r3 = await reverseSale({ transactionItemId: item3.id, reason: "Late chargeback" });
  bal = await getBalance(TEST_ID);
  check("reversed", r3.reversed);
  check("shortfall recorded", r3.shortfallKobo === 600_000, formatKobo(r3.shortfallKobo));
  check("balance did NOT go negative", bal.availableKobo >= 0 && bal.pendingKobo >= 0,
    `available ${formatKobo(bal.availableKobo)} pending ${formatKobo(bal.pendingKobo)}`);

  const adjustments = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.instructorId, TEST_ID), eq(ledgerEntries.type, "ADJUSTMENT")));
  check("shortfall left an audit row", adjustments.length === 1, `${adjustments.length} ADJUSTMENT row(s)`);

  console.log("");
  console.log("TEST 4 - refunding twice is a no-op");
  const r4 = await reverseSale({ transactionItemId: item3.id, reason: "Duplicate" });
  check("second reversal ignored", !r4.reversed);
  const refundRows = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.instructorId, TEST_ID), eq(ledgerEntries.type, "REFUND")));
  check("exactly 3 REFUND rows (one per sale)", refundRows.length === 3, `${refundRows.length} rows`);

  await cleanup();
  console.log("");
  console.log(fails === 0 ? "ALL REFUND CLAWBACK TESTS PASSED" : fails + " CHECK(S) FAILED");
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERROR", e);
  await cleanup().catch(() => {});
  process.exit(1);
});

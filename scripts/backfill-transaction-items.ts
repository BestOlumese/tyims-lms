/**
 * Backfills `transaction_item` rows for transactions created before that table existed.
 *
 * Per-course prices are recovered from `transaction.metadata`, which has always stored a
 * snapshot at purchase time:
 *   {"courses":[{"id":"…","title":"…","price":32000}]}   ← price in NAIRA
 *
 * Idempotent: transactions that already have line items are skipped, so it is safe to
 * re-run. Read-only with respect to every existing table — it only inserts.
 *
 * Usage:
 *   npx tsx scripts/backfill-transaction-items.ts --dry
 *   npx tsx scripts/backfill-transaction-items.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { transactions, transactionItems, courses } from "../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { nairaToKobo, splitLine, getCommissionRate, formatKobo } from "../lib/revenue";

const DRY = process.argv.includes("--dry");

type MetaCourse = { id: string; title?: string; price?: number };

async function main() {
  console.log(`Commission rate: ${(getCommissionRate() * 100).toFixed(2)}%`);
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "APPLYING\n");

  const allTxns = await db.select().from(transactions);
  const existing = await db
    .select({ transactionId: transactionItems.transactionId })
    .from(transactionItems);
  const done = new Set(existing.map((r) => r.transactionId));

  let created = 0;
  let skipped = 0;
  let noMeta = 0;

  for (const txn of allTxns) {
    if (done.has(txn.id)) {
      skipped++;
      continue;
    }

    const meta = txn.metadata as { courses?: MetaCourse[] } | null;
    const metaCourses = meta?.courses ?? [];

    if (metaCourses.length === 0) {
      console.warn(`  ! ${txn.paystackReference}: no metadata.courses — cannot attribute, skipping`);
      noMeta++;
      continue;
    }

    // instructorId isn't in the metadata snapshot, so resolve it from the course table.
    // This is the one place where "current owner" is unavoidable — for historical rows
    // it's the best available signal. Going forward it's snapshotted at checkout.
    const courseIds = metaCourses.map((c) => c.id);
    const courseRows = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(inArray(courses.id, courseIds));
    const instructorByCourse = new Map(courseRows.map((c) => [c.id, c.instructorId]));

    const rows = [];
    for (const mc of metaCourses) {
      const instructorId = instructorByCourse.get(mc.id);
      if (!instructorId) {
        console.warn(`  ! ${txn.paystackReference}: course ${mc.id} no longer exists, skipping line`);
        continue;
      }
      const unitPriceKobo = nairaToKobo(mc.price ?? 0);
      const split = splitLine(unitPriceKobo);
      rows.push({
        transactionId: txn.id,
        courseId: mc.id,
        instructorId,
        unitPriceKobo: split.unitPriceKobo,
        platformFeeKobo: split.platformFeeKobo,
        instructorEarningKobo: split.instructorEarningKobo,
      });
    }

    if (rows.length === 0) continue;

    const lineTotal = rows.reduce((s, r) => s + r.unitPriceKobo, 0);
    // amount = subtotal + paystack fee, so lines should reconcile to amount - serviceFee.
    const expectedSubtotal = txn.amount - txn.serviceFee;
    const flag = lineTotal !== expectedSubtotal ? "  ⚠ MISMATCH" : "";
    console.log(
      `  ${txn.status.padEnd(8)} ${txn.paystackReference}  ${rows.length} line(s)  ` +
        `lines=${formatKobo(lineTotal)} expected=${formatKobo(expectedSubtotal)}${flag}`,
    );

    if (!DRY) {
      await db.insert(transactionItems).values(rows);
    }
    created += rows.length;
  }

  console.log(
    `\n${DRY ? "would create" : "created"} ${created} line item(s) · ` +
      `${skipped} txn already done · ${noMeta} txn without metadata`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("BACKFILL FAILED:", e);
  process.exit(1);
});

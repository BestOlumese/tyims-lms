/**
 * Seeds the instructor ledger from transaction line items that were recorded before the
 * ledger existed.
 *
 * Idempotent: `ledger_txn_item_unique_idx` allows one SALE entry per transaction_item, so
 * re-running credits nothing new. Safe to run repeatedly.
 *
 * Only `status = 'success'` transactions are credited — pending and failed ones are not
 * money.
 *
 * Usage:
 *   npx tsx scripts/backfill-ledger.ts --dry
 *   npx tsx scripts/backfill-ledger.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { transactions, transactionItems, users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { creditSale, getBalance } from "../lib/payouts/ledger";
import { formatKobo } from "../lib/revenue";
import { getHoldDays } from "../lib/payouts/config";

const DRY = process.argv.includes("--dry");

async function main() {
  console.log(`Hold period: ${getHoldDays()} days`);
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "APPLYING\n");

  const rows = await db
    .select({
      itemId: transactionItems.id,
      instructorId: transactionItems.instructorId,
      instructorName: users.name,
      earningKobo: transactionItems.instructorEarningKobo,
      verifiedAt: transactions.verifiedAt,
      reference: transactions.paystackReference,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .leftJoin(users, eq(users.id, transactionItems.instructorId))
    .where(eq(transactions.status, "success"));

  console.log(`${rows.length} line item(s) from successful transactions\n`);

  let credited = 0;
  let skipped = 0;

  for (const r of rows) {
    if (DRY) {
      console.log(
        `  would credit ${r.instructorName}  ${formatKobo(r.earningKobo)}  (${r.reference})`,
      );
      credited++;
      continue;
    }
    const res = await creditSale({
      instructorId: r.instructorId,
      transactionItemId: r.itemId,
      amountKobo: r.earningKobo,
      soldAt: r.verifiedAt ?? new Date(),
    });
    if (res.credited) {
      credited++;
      console.log(`  credited ${r.instructorName}  ${formatKobo(r.earningKobo)}`);
    } else {
      skipped++;
      console.log(`  already credited — skipped (${r.reference})`);
    }
  }

  console.log(`\n${DRY ? "would credit" : "credited"} ${credited} · skipped ${skipped}`);

  if (!DRY) {
    const instructorIds = [...new Set(rows.map((r) => r.instructorId))];
    console.log("\nRESULTING BALANCES");
    for (const id of instructorIds) {
      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
      const b = await getBalance(id);
      console.log(
        `  ${(u?.name ?? id).padEnd(16)} available ${formatKobo(b.availableKobo).padStart(14)}` +
          `  pending ${formatKobo(b.pendingKobo).padStart(14)}` +
          `  withdrawn ${formatKobo(b.withdrawnKobo)}`,
      );
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("BACKFILL FAILED:", e);
  process.exit(1);
});

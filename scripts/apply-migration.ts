/**
 * Applies a hand-written SQL migration file.
 *
 * Usage: npx tsx scripts/apply-migration.ts drizzle/0001_transaction_items_and_notifications.sql
 *
 * `drizzle-kit generate` can't be used for these because the drizzle/0000 snapshot has
 * drifted from lib/db/schema.ts (the database is current — the project used `db:push`),
 * so a generated diff prompts for rename resolution across existing tables.
 * The migrations this applies are strictly additive and individually guarded.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/apply-migration.ts <path-to-sql>");
    process.exit(1);
  }

  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) {
    console.error(`Not found: ${full}`);
    process.exit(1);
  }

  const statements = fs.readFileSync(full, "utf8");
  console.log(`Applying ${path.basename(full)} …`);

  // Run the whole file in one call so DO $$ … $$ blocks stay intact — splitting on ";"
  // would break them apart.
  await db.execute(sql.raw(statements));

  console.log("Applied successfully.");
  process.exit(0);
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});

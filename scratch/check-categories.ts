import "dotenv/config";
import { db } from "../lib/db";
import { categories } from "../lib/db/schema";

async function main() {
  try {
    const allCategories = await db.select().from(categories);
    console.log(JSON.stringify(allCategories, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();

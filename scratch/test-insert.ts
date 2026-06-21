import "dotenv/config";
import { db } from "../lib/db";
import { categories } from "../lib/db/schema";

async function main() {
  try {
    const [newCategory] = await db.insert(categories).values({
      name: "Web Development",
      slug: "web-development",
    }).returning();
    console.log("Created:", newCategory);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();

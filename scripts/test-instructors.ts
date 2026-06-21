import "dotenv/config";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq, count, and, sql, ilike } from "drizzle-orm";

async function main() {
  try {
    // Test 1: basic count
    const whereClause = and(
      eq(users.role, "INSTRUCTOR"),
      undefined,
    );
    const result = await db.select({ value: count() }).from(users).where(whereClause);
    console.log("Count:", result);

    // Test 2: with subqueries
    const rows = await db.select({
      id: users.id,
      name: users.name,
      courseCount: sql<number>`(SELECT count(*)::int FROM "course" c WHERE c.instructor_id = "user"."id" AND c.status = 'PUBLISHED')`,
      studentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e INNER JOIN "course" c ON e.course_id = c.id WHERE c.instructor_id = "user"."id")`,
    }).from(users).where(whereClause).limit(3);
    console.log("Rows:", JSON.stringify(rows, null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
  process.exit(0);
}

main();

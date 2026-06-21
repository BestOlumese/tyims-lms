import "dotenv/config";
import { db } from "./lib/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Creating quiz_submission_answer table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "quiz_submission_answer" (
      "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
      "submission_id" text NOT NULL REFERENCES "quiz_submission"("id") ON DELETE CASCADE,
      "question_id" text NOT NULL REFERENCES "quiz_question"("id") ON DELETE CASCADE,
      "selected_option_id" text NOT NULL REFERENCES "quiz_option"("id") ON DELETE CASCADE,
      "is_correct" boolean NOT NULL
    );
  `);
  console.log("Done!");
  process.exit(0);
}

run();

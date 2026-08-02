-- Adds per-course revenue attribution + in-app notifications.
--
-- Written by hand rather than via `drizzle-kit generate`: the drizzle/0000 snapshot has
-- drifted from lib/db/schema.ts (the database itself is current — the project has been
-- using `db:push`), so a generated diff prompted for column rename resolution across
-- existing tables. This migration is strictly additive: it creates two new tables and one
-- new enum and does not touch a single existing column.
--
-- Safe to re-run: every statement is guarded.

--------------------------------------------------------------------------------
-- 1. transaction_item — one row per course per transaction
--------------------------------------------------------------------------------
-- `transaction` stores only course_ids text[] plus one combined amount, so a purchase
-- spanning two instructors cannot be attributed. instructor_id is snapshotted here so
-- reassigning a course later cannot rewrite historical earnings.
-- All amounts in kobo (integers).

CREATE TABLE IF NOT EXISTS "transaction_item" (
  "id"                       text PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id"           text NOT NULL REFERENCES "transaction"("id") ON DELETE CASCADE,
  "course_id"                text NOT NULL REFERENCES "course"("id"),
  "instructor_id"            text NOT NULL REFERENCES "user"("id"),
  "unit_price_kobo"          integer NOT NULL,
  "platform_fee_kobo"        integer NOT NULL DEFAULT 0,
  "instructor_earning_kobo"  integer NOT NULL,
  "created_at"               timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "txn_item_instructor_idx" ON "transaction_item" ("instructor_id");
CREATE INDEX IF NOT EXISTS "txn_item_course_idx"     ON "transaction_item" ("course_id");
CREATE INDEX IF NOT EXISTS "txn_item_txn_idx"        ON "transaction_item" ("transaction_id");

--------------------------------------------------------------------------------
-- 2. notification_type enum
--------------------------------------------------------------------------------
-- CREATE TYPE has no IF NOT EXISTS, so guard it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "notification_type" AS ENUM (
      'PAYMENT_SUCCEEDED',
      'PAYMENT_FAILED',
      'INSTRUCTOR_APPLICATION',
      'COURSE_PURCHASED',
      'COURSE_REVIEWED',
      'APPLICATION_APPROVED',
      'APPLICATION_REJECTED'
    );
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 3. notification
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "notification" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type"         "notification_type" NOT NULL,
  "title"        text NOT NULL,
  "body"         text,
  "link"         text,
  "entity_type"  text,
  "entity_id"    text,
  "actor_id"     text REFERENCES "user"("id") ON DELETE SET NULL,
  "read_at"      timestamp,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

-- Drives the unread badge and the inbox list.
CREATE INDEX IF NOT EXISTS "notification_recipient_idx" ON "notification" ("recipient_id", "read_at");
CREATE INDEX IF NOT EXISTS "notification_created_idx"   ON "notification" ("created_at");

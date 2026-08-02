-- Instructor payouts: bank accounts, append-only ledger, materialised balances,
-- withdrawal records, and transaction-PIN fields on `user`.
--
-- Hand-written for the same reason as 0001: the drizzle/0000 snapshot has drifted from
-- lib/db/schema.ts, so `drizzle-kit generate` prompts for rename resolution across existing
-- tables. Strictly additive — creates new types/tables and only ADDs nullable/defaulted
-- columns to `user`. No existing column is altered or dropped.
--
-- Safe to re-run: every statement is guarded.
--
-- MONEY RULES ENCODED HERE:
--   · every amount is integer kobo (never float/numeric — no rounding drift)
--   · ledger_entry is append-only; there is one SALE credit per transaction_item, enforced
--     by a unique index rather than by application discipline
--   · instructor_balance is the single row a withdrawal locks (SELECT … FOR UPDATE)
--   · payout.reference is UNIQUE — the idempotency key against Paystack

--------------------------------------------------------------------------------
-- 1. Enums
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'ledger_entry_type' AND n.nspname = 'public') THEN
    CREATE TYPE "ledger_entry_type" AS ENUM (
      'SALE', 'PAYOUT', 'PAYOUT_FEE', 'PAYOUT_REVERSAL', 'REFUND', 'ADJUSTMENT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'payout_status' AND n.nspname = 'public') THEN
    CREATE TYPE "payout_status" AS ENUM (
      'REQUESTED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED'
    );
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. Transaction PIN + lockout on `user`
--------------------------------------------------------------------------------
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transaction_pin_hash"    text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "transaction_pin_set_at"  timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pin_failed_attempts"     integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pin_locked_until"        timestamp;

--------------------------------------------------------------------------------
-- 3. Bank account (one per instructor)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "instructor_payout_account" (
  "id"                 text PRIMARY KEY DEFAULT gen_random_uuid(),
  "instructor_id"      text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "bank_code"          text NOT NULL,
  "bank_name"          text NOT NULL,
  "account_number"     text NOT NULL,
  -- The REAL holder name from Paystack /bank/resolve. Never user-supplied.
  "account_name"       text NOT NULL,
  "name_match_score"   real NOT NULL DEFAULT 0,
  "recipient_code"     text,
  "verified_at"        timestamp,
  "manually_approved"  boolean NOT NULL DEFAULT false,
  "approved_by"        text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at"         timestamp NOT NULL DEFAULT now(),
  "updated_at"         timestamp NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 4. Materialised balance — the row a withdrawal locks
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "instructor_balance" (
  "instructor_id"  text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "available_kobo" integer NOT NULL DEFAULT 0,
  "pending_kobo"   integer NOT NULL DEFAULT 0,
  "reserved_kobo"  integer NOT NULL DEFAULT 0,
  "withdrawn_kobo" integer NOT NULL DEFAULT 0,
  "updated_at"     timestamp NOT NULL DEFAULT now()
);

-- Money can never go negative. If application logic ever gets this wrong the database
-- refuses the write rather than silently paying out money that doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instructor_balance_non_negative') THEN
    ALTER TABLE "instructor_balance" ADD CONSTRAINT "instructor_balance_non_negative"
      CHECK ("available_kobo" >= 0 AND "pending_kobo" >= 0 AND "reserved_kobo" >= 0);
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 5. Append-only ledger
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ledger_entry" (
  "id"                  text PRIMARY KEY DEFAULT gen_random_uuid(),
  "instructor_id"       text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type"                "ledger_entry_type" NOT NULL,
  "amount_kobo"         integer NOT NULL,
  "balance_after_kobo"  integer NOT NULL,
  "available_at"        timestamp,
  "transaction_item_id" text REFERENCES "transaction_item"("id") ON DELETE SET NULL,
  "payout_id"           text,
  "note"                text,
  "created_at"          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ledger_instructor_idx" ON "ledger_entry" ("instructor_id", "created_at");
CREATE INDEX IF NOT EXISTS "ledger_available_idx"  ON "ledger_entry" ("available_at");

-- Exactly one SALE credit per line item. This is what makes crediting the ledger safe to
-- retry: a duplicate insert is rejected by the database, not by a race-prone pre-check.
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_txn_item_unique_idx"
  ON "ledger_entry" ("transaction_item_id")
  WHERE "transaction_item_id" IS NOT NULL;

--------------------------------------------------------------------------------
-- 6. Payouts
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payout" (
  "id"                      text PRIMARY KEY DEFAULT gen_random_uuid(),
  "instructor_id"           text NOT NULL REFERENCES "user"("id"),
  "amount_kobo"             integer NOT NULL,
  "fee_kobo"                integer NOT NULL DEFAULT 0,
  "net_kobo"                integer NOT NULL,
  "status"                  "payout_status" NOT NULL DEFAULT 'REQUESTED',
  -- Idempotency key sent to Paystack. UNIQUE stops a retry paying twice.
  "reference"               text NOT NULL UNIQUE,
  "bank_name"               text NOT NULL,
  "account_number_masked"   text NOT NULL,
  "account_name"            text NOT NULL,
  "paystack_transfer_code"  text,
  "failure_reason"          text,
  "approved_by"             text REFERENCES "user"("id") ON DELETE SET NULL,
  "requested_at"            timestamp NOT NULL DEFAULT now(),
  "processed_at"            timestamp,
  "completed_at"            timestamp
);

CREATE INDEX IF NOT EXISTS "payout_instructor_idx" ON "payout" ("instructor_id", "requested_at");
CREATE INDEX IF NOT EXISTS "payout_status_idx"     ON "payout" ("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_amounts_positive') THEN
    ALTER TABLE "payout" ADD CONSTRAINT "payout_amounts_positive"
      CHECK ("amount_kobo" > 0 AND "fee_kobo" >= 0 AND "net_kobo" > 0);
  END IF;
END $$;

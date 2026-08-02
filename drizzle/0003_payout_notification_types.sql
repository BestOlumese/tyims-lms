-- Payout notification types.
--
-- Additive only: ALTER TYPE … ADD VALUE IF NOT EXISTS never rewrites existing rows and
-- cannot fail on re-run.
--
-- PAYOUT_QUEUED   → admins: a withdrawal above the auto-approve threshold needs review
-- PAYOUT_SENT     → instructor: transfer.success
-- PAYOUT_FAILED   → instructor: transfer.failed / transfer.reversed, money returned
-- BANK_ACCOUNT_REVIEW → admins: a bank account whose name didn't match needs a human

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_QUEUED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_SENT';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_FAILED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'BANK_ACCOUNT_REVIEW';

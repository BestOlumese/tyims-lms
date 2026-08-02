/**
 * Payout policy. Every threshold lives here so there is exactly one place to change it.
 *
 * All amounts are integer kobo.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.warn(`[payouts] ${name}="${raw}" is not a non-negative number — using ${fallback}.`);
    return fallback;
  }
  return Math.floor(n);
}

/** Days a sale is held before it becomes withdrawable — the refund/chargeback buffer. */
export function getHoldDays(): number {
  return envInt("PAYOUT_HOLD_DAYS", 7);
}

/** Smallest withdrawal. Below this, transfer fees are a silly proportion of the amount. */
export function getMinPayoutKobo(): number {
  return envInt("PAYOUT_MIN_KOBO", 500_000); // ₦5,000
}

/**
 * At or below this, a valid request dispatches automatically.
 * Above it, an admin must approve before any money moves.
 * Set to 0 to require approval for everything.
 */
export function getAutoApproveMaxKobo(): number {
  return envInt("PAYOUT_AUTO_APPROVE_MAX_KOBO", 5_000_000); // ₦50,000
}

/**
 * What Paystack will charge us to send this amount, which we pass on to the instructor.
 *
 * Two components:
 *   · transfer fee — ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above
 *   · stamp duty  — flat ₦50 on any transfer of ₦10,000 or more (Nigerian law, Feb 2026)
 *
 * Deliberately conservative: if Paystack's actual fee is lower we over-collect by a few
 * naira rather than eating a shortfall on every payout. Revisit if their pricing changes.
 */
export function calcPayoutFeeKobo(amountKobo: number): number {
  const naira = amountKobo / 100;

  let transferFeeNaira: number;
  if (naira <= 5_000) transferFeeNaira = 10;
  else if (naira <= 50_000) transferFeeNaira = 25;
  else transferFeeNaira = 50;

  const stampDutyNaira = naira >= 10_000 ? 50 : 0;

  return Math.round((transferFeeNaira + stampDutyNaira) * 100);
}

/** Minimum consecutive wrong PINs before the account is locked out. */
export const PIN_MAX_ATTEMPTS = 5;

/** How long a PIN lockout lasts. */
export const PIN_LOCKOUT_MINUTES = 30;

/** Required PIN length. 6 digits = 1,000,000 combinations. */
export const PIN_LENGTH = 6;

/**
 * Name-match threshold for auto-verifying a bank account.
 * Below this the account is stored but goes to an admin review queue rather than being
 * rejected — real names legitimately differ from bank records (middle names, maiden names).
 */
export const NAME_MATCH_AUTO_APPROVE = 0.6;

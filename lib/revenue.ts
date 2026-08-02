/**
 * Money rules for the platform. Every revenue figure in the app must come from here so
 * the admin and instructor dashboards can never disagree.
 *
 * ── Units ──────────────────────────────────────────────────────────────────────
 * Everything is in **kobo** (integer minor units). Never hold money in a float:
 * `0.1 + 0.2 !== 0.3`, and course prices are edited by hand. Convert only at the edges,
 * with `koboToNaira` / `formatKobo`.
 *
 * Careful: `course.price` / `course.discountPrice` are stored in **naira** (real), while
 * `transaction.amount` is in **kobo**. `nairaToKobo` is the only sanctioned bridge.
 *
 * ── Who gets what ──────────────────────────────────────────────────────────────
 *   buyer pays       = subtotal + paystack fee   (fee added on top; the buyer absorbs it)
 *   subtotal         = Σ effective course prices
 *   platform cut     = subtotal × PLATFORM_COMMISSION_PCT
 *   instructor earns = subtotal − platform cut
 *
 * The Paystack processing fee (`calcServiceFee` in lib/paystack.ts) is NOT platform
 * profit — it goes to Paystack. It must never be counted as revenue on either dashboard.
 *
 * ⚠️ Instructor payouts are not implemented. `users.paystackSubaccountCode` exists but
 * nothing uses it, so 100% of every payment currently lands in the platform account.
 * These figures describe what an instructor has *earned*, not what has been paid to them.
 */

/**
 * Platform commission as a fraction (0.2 = 20%).
 *
 * Deliberately configurable and defaulting to 0: the split had not been decided when this
 * was built. Set PLATFORM_COMMISSION_PCT to the agreed percentage — as a whole number
 * (e.g. `20`) — and every figure across the app follows without a code change.
 */
export function getCommissionRate(): number {
  const raw = process.env.PLATFORM_COMMISSION_PCT;
  if (!raw) return 0;

  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    console.warn(
      `[revenue] PLATFORM_COMMISSION_PCT="${raw}" is not a number between 0 and 100 — falling back to 0%.`,
    );
    return 0;
  }
  return pct / 100;
}

/** Naira (as stored on `course.price`) → kobo. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** The price a course actually sells for: discountPrice when set and > 0, else price. */
export function effectivePriceNaira(course: {
  price: number;
  discountPrice?: number | null;
}): number {
  return course.discountPrice != null && course.discountPrice > 0
    ? course.discountPrice
    : course.price;
}

export type LineSplit = {
  unitPriceKobo: number;
  platformFeeKobo: number;
  instructorEarningKobo: number;
};

/**
 * Split one course's price between platform and instructor.
 * Rounding favours the instructor never being short-changed by sub-kobo drift:
 * the platform fee is rounded, and the instructor takes the exact remainder.
 */
export function splitLine(unitPriceKobo: number, rate = getCommissionRate()): LineSplit {
  const platformFeeKobo = Math.round(unitPriceKobo * rate);
  return {
    unitPriceKobo,
    platformFeeKobo,
    instructorEarningKobo: unitPriceKobo - platformFeeKobo,
  };
}

/** Format kobo for display, e.g. 23410000 → "₦234,100.00". */
export function formatKobo(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(koboToNaira(kobo));
}

/** Compact form for dashboard tiles, e.g. 23410000 → "₦234.1k". */
export function formatKoboCompact(kobo: number): string {
  const naira = koboToNaira(kobo);
  if (Math.abs(naira) >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}m`;
  if (Math.abs(naira) >= 1_000) return `₦${(naira / 1_000).toFixed(1)}k`;
  return `₦${naira.toFixed(0)}`;
}

/** Percentage change between two periods, guarding division by zero. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "no baseline"
  return ((current - previous) / previous) * 100;
}

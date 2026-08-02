import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PIN_LENGTH, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MINUTES } from "./config";

/**
 * Promisified scrypt. Wrapped by hand rather than with util.promisify because promisify
 * resolves to the 3-argument overload, which gives no way to pass the cost parameter.
 */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Transaction PIN — the second factor on withdrawals and on changing bank details.
 *
 * Hashing: Node's built-in scrypt with a per-PIN random salt. No new dependency, and
 * scrypt is deliberately memory-hard so each guess costs real work.
 *
 * Being honest about the limits: a 6-digit PIN is only 1,000,000 combinations. If an
 * attacker ever obtained the hash they could exhaust that space offline no matter which
 * algorithm we use. The PIN is therefore NOT the primary defence — the real protections
 * are that the hash is never exposed, attempts are counted and locked out, and payouts
 * above a threshold need human approval. Treat the PIN as "proof this session is really
 * the account owner", not as a cryptographic secret.
 *
 * NEVER log the plaintext PIN or the stored hash.
 */

const KEY_LEN = 64;
const SCRYPT_COST = 16384; // N — CPU/memory cost

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(pin, salt, KEY_LEN, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt}$${derived.toString("hex")}`;
}

async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  try {
    const [scheme, costRaw, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const cost = Number(costRaw) || SCRYPT_COST;
    const derived = await scryptAsync(pin, salt, KEY_LEN, { N: cost });
    const expected = Buffer.from(hash, "hex");
    if (expected.length !== derived.length) return false;
    // Constant-time: a compare that short-circuits on the first differing byte leaks
    // information about the hash through timing.
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Reject trivially guessable PINs — repeated digits or simple runs. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true; // 000000, 111111
  const ascending = "0123456789012345";
  const descending = "9876543210987654";
  return ascending.includes(pin) || descending.includes(pin);
}

export type PinCheckResult =
  | { ok: true }
  | { ok: false; reason: "NOT_SET" | "LOCKED" | "INVALID"; message: string; retriesLeft?: number; lockedUntil?: Date };

/**
 * Verify a PIN and maintain the lockout counter.
 *
 * On success the counter resets. On failure it increments, and at PIN_MAX_ATTEMPTS the
 * account is locked for PIN_LOCKOUT_MINUTES. Always call this — never compare hashes
 * anywhere else, or the counter stops being meaningful.
 */
export async function verifyTransactionPin(
  userId: string,
  pin: string,
): Promise<PinCheckResult> {
  const [user] = await db
    .select({
      hash: users.transactionPinHash,
      attempts: users.pinFailedAttempts,
      lockedUntil: users.pinLockedUntil,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.hash) {
    return {
      ok: false,
      reason: "NOT_SET",
      message: "Set a transaction PIN before withdrawing.",
    };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      ok: false,
      reason: "LOCKED",
      message: `Too many incorrect attempts. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      lockedUntil: user.lockedUntil,
    };
  }

  const valid = await verifyPinHash(pin, user.hash);

  if (valid) {
    if (user.attempts > 0 || user.lockedUntil) {
      await db
        .update(users)
        .set({ pinFailedAttempts: 0, pinLockedUntil: null })
        .where(eq(users.id, userId));
    }
    return { ok: true };
  }

  const attempts = (user.attempts ?? 0) + 1;
  const shouldLock = attempts >= PIN_MAX_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60 * 1000)
    : null;

  await db
    .update(users)
    .set({
      pinFailedAttempts: shouldLock ? 0 : attempts,
      pinLockedUntil: lockedUntil,
    })
    .where(eq(users.id, userId));

  if (shouldLock) {
    return {
      ok: false,
      reason: "LOCKED",
      message: `Too many incorrect attempts. Withdrawals are locked for ${PIN_LOCKOUT_MINUTES} minutes.`,
      lockedUntil: lockedUntil ?? undefined,
    };
  }

  return {
    ok: false,
    reason: "INVALID",
    message: "Incorrect PIN.",
    retriesLeft: PIN_MAX_ATTEMPTS - attempts,
  };
}

/** Set a PIN for the first time. */
export async function setTransactionPin(userId: string, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await db
    .update(users)
    .set({
      transactionPinHash: hash,
      transactionPinSetAt: new Date(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    })
    .where(eq(users.id, userId));
}

/** Whether the user has a PIN configured (used to gate the withdrawal UI). */
export async function hasTransactionPin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ hash: users.transactionPinHash })
    .from(users)
    .where(eq(users.id, userId));
  return Boolean(row?.hash);
}

/** Current lockout state, for showing an accurate message before a PIN is even entered. */
export async function getPinStatus(userId: string) {
  const [row] = await db
    .select({
      hash: users.transactionPinHash,
      setAt: users.transactionPinSetAt,
      attempts: users.pinFailedAttempts,
      lockedUntil: users.pinLockedUntil,
    })
    .from(users)
    .where(eq(users.id, userId));

  const locked = Boolean(row?.lockedUntil && row.lockedUntil > new Date());
  return {
    isSet: Boolean(row?.hash),
    setAt: row?.setAt ?? null,
    isLocked: locked,
    lockedUntil: locked ? row?.lockedUntil ?? null : null,
    failedAttempts: row?.attempts ?? 0,
    maxAttempts: PIN_MAX_ATTEMPTS,
  };
}

/** Force-clear a lockout. Admin recovery path. */
export async function clearPinLockout(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ pinFailedAttempts: 0, pinLockedUntil: null })
    .where(eq(users.id, userId));
}

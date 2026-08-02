/**
 * Compares an instructor's profile name against the account holder name returned by
 * Paystack, to decide whether we are about to pay the right person.
 *
 * Why fuzzy rather than exact: Nigerian bank records legitimately differ from a profile
 * name — extra middle names, surname first, initials, maiden/married names, all-caps.
 * Exact matching would reject a large share of honest instructors.
 *
 * Why not lenient: the entire point is to stop an instructor pointing payouts at someone
 * else's account. So a weak match does NOT auto-reject and does NOT auto-approve — it goes
 * to an admin queue for a human to look at.
 *
 * This is a heuristic, not proof of identity. It is one layer among several (PIN, hold
 * period, approval threshold, admin review).
 */

/** Strip punctuation/diacritics, collapse whitespace, uppercase, split into tokens. */
function tokenize(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop accents
    .toUpperCase()
    .replace(/[^A-Z\s-]/g, " ") // punctuation → space
    .replace(/-/g, " ") // treat hyphenated names as separate tokens
    .split(/\s+/)
    .filter((t) => t.length > 0)
    // Common honorifics carry no identity information.
    .filter((t) => !["MR", "MRS", "MS", "DR", "PROF", "ENGR", "CHIEF"].includes(t));
}

/** An initial matches a full name that starts with it: "C" ↔ "CHUKWUMA". */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  return false;
}

export type NameMatchResult = {
  /** 0..1 — the fraction of the shorter name's tokens found in the longer one. */
  score: number;
  matched: string[];
  unmatched: string[];
  reason: string;
};

/**
 * Score how well a profile name corresponds to a bank account name.
 *
 * Uses token overlap against the SHORTER token set, so extra middle names in the bank
 * record don't penalise the match — "Chukwuma Okeke" vs "OKEKE CHUKWUMA JOHN" scores 1.0,
 * while "Chukwuma Okeke" vs "ADEBAYO SULEIMAN" scores 0.
 */
export function compareNames(profileName: string, bankName: string): NameMatchResult {
  const profileTokens = tokenize(profileName ?? "");
  const bankTokens = tokenize(bankName ?? "");

  if (profileTokens.length === 0 || bankTokens.length === 0) {
    return {
      score: 0,
      matched: [],
      unmatched: profileTokens,
      reason: "One of the names was empty after normalisation.",
    };
  }

  // Compare against the shorter set — extra middle names shouldn't count against anyone.
  const [shorter, longer] =
    profileTokens.length <= bankTokens.length
      ? [profileTokens, bankTokens]
      : [bankTokens, profileTokens];

  const remaining = [...longer];
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const token of shorter) {
    const idx = remaining.findIndex((r) => tokensMatch(token, r));
    if (idx >= 0) {
      matched.push(token);
      remaining.splice(idx, 1); // consume, so one token can't match twice
    } else {
      unmatched.push(token);
    }
  }

  const score = matched.length / shorter.length;

  let reason: string;
  if (score === 1) {
    reason = "Every name part matched the account holder.";
  } else if (score > 0) {
    reason = `Only ${matched.length} of ${shorter.length} name parts matched (${unmatched.join(", ")} not found).`;
  } else {
    reason = "No part of the name matched the account holder.";
  }

  return { score, matched, unmatched, reason };
}

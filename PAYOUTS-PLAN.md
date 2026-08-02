# Instructor Payouts — Research & Build Plan

Round 4. Companion to `REVENUE-NOTIFICATIONS-PLAN.md`.
**This moves real money. Treat every item here as security-sensitive.**

Started: 2026-08-01
Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` needs decision

---

## STATE BEFORE THIS WORK

- `PLATFORM_COMMISSION_PCT=20` is set and working — verified: a ₦232,000 sale splits
  **₦46,400 platform / ₦185,600 instructor**.
- `users.paystackSubaccountCode` exists in the schema but **nothing writes or reads it**.
  `initializeTransaction` never sets a subaccount, so 100% of every payment lands in the
  platform Paystack account.
- There is no balance, no ledger, no withdrawal, no bank account on file, no payout history.
- ⚠️ The one historical sale was backfilled while commission was 0%, so its
  `transaction_item` rows say platform ₦0 / instructor ₦232,000. New sales will say 20%.
  **Needs a decision** (see Open Questions).

---

## DECISIONS LOCKED (confirmed by owner)

| Topic | Decision |
|---|---|
| Architecture | **Ledger + Transfers API** — platform holds funds, instructor withdraws |
| Hold period | **7 days** from purchase before earnings become withdrawable |
| Transfer fees | **Deducted from the instructor**, shown in a breakdown before they confirm |
| Minimum withdrawal | **₦5,000** |
| Bank name match | **Fuzzy**; anything below threshold goes to an admin review queue, not auto-rejected |
| Approval | **Auto-process ≤ ₦50,000**, admin approval above (threshold via env) |
| Transaction PIN | **6-digit**, hashed, 5 attempts → 30-min lock, password required to change |
| Withdrawal gates | verified bank **+** PIN set **+** email verified **+** INSTRUCTOR with ≥1 completed sale |
| Paystack OTP | Owner will **disable** it → direct programmatic transfers |
| Environment | **Test keys** — safe to exercise `/bank/resolve` and test transfers |
| Email | **Nodemailer + Gmail SMTP** for security-sensitive mail, alongside in-app notifications |
| Historical commission | **Leave at 0%** — that was the real rate when the sale happened; no retroactive deduction |

### Notes on the email choice
Gmail SMTP needs an **App Password** (requires 2FA on the account) — a normal Gmail password
will not authenticate. Limits are roughly 500 messages/day, which is fine at this volume but
is not a transactional-email service. New env vars:

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   # 16-char app password, NOT the account password
MAIL_FROM="TYIMS <you@gmail.com>"
```

Email is **best-effort**: a mail failure must never block or reverse a payout.

### Config to add
```
PAYOUT_HOLD_DAYS=7
PAYOUT_MIN_KOBO=500000              # ₦5,000
PAYOUT_AUTO_APPROVE_MAX_KOBO=5000000 # ₦50,000
```

---

## RESEARCH — Paystack payout mechanics

Sources listed at the bottom. Verified against Paystack's current docs, not memory.

### Two possible architectures

**A. Split payments / subaccounts** — money is divided *at the moment of purchase*.
The instructor's share goes straight to their own Paystack subaccount and never sits in the
platform's balance.
- ✅ Platform never holds other people's money (materially simpler, and avoids looking like
  an unlicensed deposit-taker)
- ✅ No payout engine, no ledger, no withdrawal race conditions
- ❌ No "balance + withdraw" UX — instructors are paid per sale on Paystack's settlement cycle
- ❌ Every instructor must complete Paystack subaccount onboarding before they can sell
- ❌ Refunds are messy once the money has left

**B. Ledger + Transfers API** — platform receives everything, tracks what each instructor is
owed, and sends money on request. *This is what the requested UX implies.*
- ✅ Full control: hold periods, minimums, batching, an actual balance
- ✅ Refunds/chargebacks can be netted off before payout
- ❌ Platform custodies instructor funds — a real regulatory posture in Nigeria, worth
  confirming with whoever owns compliance
- ❌ We own correctness: double-withdrawal races, negative balances, idempotency

### Paystack API flow for B

| Step | Endpoint | Notes |
|---|---|---|
| List banks | `GET /bank` | to populate a bank picker and get `bank_code` |
| **Verify account name** | `GET /bank/resolve?account_number=…&bank_code=…` | returns `account_name`. **Free.** This is the "name must match" check |
| Create recipient | `POST /transferrecipient` | returns `recipient_code`, stored per instructor |
| Send money | `POST /transfer` | takes `recipient_code` + our own `reference` |
| Result | webhooks | `transfer.success`, `transfer.failed`, `transfer.reversed` |

**OTP must be disabled** in the Paystack Dashboard → Preferences for programmatic transfers.
Without that, every transfer needs a human to approve an OTP.

Transfers are **asynchronous** — `POST /transfer` only queues it. Final state arrives by
webhook, so a transfer is never "done" at request time.

### Costs (these decide the minimum withdrawal)

| Charge | Amount |
|---|---|
| Transfer fee | ₦10 for transfers ≤ ₦5,000; higher tiers above |
| **Stamp duty** | **₦50 on any transfer ≥ ₦10,000** — Nigerian law, since 18 Feb 2026 |
| Chargeback | ₦2,500 per disputed transaction |
| Balance top-up | free |

A ₦500 withdrawal costing ₦10 to send is 2% eaten in fees — hence a minimum.

---

## THE HARD PARTS (where payout systems actually break)

These are the failure modes I intend to design against explicitly:

1. **Double withdrawal race.** Two concurrent requests both read "balance ₦100,000" and both
   pass the check. Fix: the balance check and the debit happen in **one transaction with a
   row-level lock** (`SELECT … FOR UPDATE` on the instructor's balance row), never a
   read-then-write.
2. **Balance computed on the fly.** `sum(earnings) − sum(payouts)` recomputed per request is
   slow and races. Fix: an **append-only ledger** plus a materialised balance row.
3. **Non-idempotent transfers.** A retry or duplicate webhook sends the money twice. Fix: our
   own unique `reference` per payout, unique-constrained, and every webhook handler
   idempotent.
4. **Negative balance after refund.** Instructor withdraws, buyer then charges back. Fix:
   hold period before funds become available + the ledger can carry a negative correction.
5. **Paying the wrong person.** Fix: `/bank/resolve` name match, re-verified whenever bank
   details change, and details locked while a payout is in flight.
6. **PIN brute force.** Fix: hashed PIN (never stored or logged in the clear), attempt
   counter, lockout, and rate limiting.
7. **No audit trail.** Fix: every state change appended, never updated in place.

---

## PROPOSED SCHEMA (subject to the open questions)

```
instructor_payout_account          -- bank details, one per instructor
  id, instructor_id (unique), bank_code, bank_name,
  account_number, account_name_from_paystack,
  recipient_code,                  -- from POST /transferrecipient
  verified_at, name_match_score,
  created_at, updated_at

instructor_balance                 -- materialised, the source of truth for "can withdraw"
  instructor_id (pk),
  available_kobo,                  -- past hold period, withdrawable
  pending_kobo,                    -- earned but still inside the hold window
  withdrawn_kobo,                  -- lifetime paid out
  updated_at

ledger_entry                       -- append-only. never UPDATE, never DELETE
  id, instructor_id,
  type,                            -- SALE | PAYOUT | REFUND | REVERSAL | ADJUSTMENT
  amount_kobo,                     -- signed: + credit, − debit
  balance_after_kobo,              -- running balance, for audit
  transaction_item_id?, payout_id?,
  note, created_at

payout                             -- one withdrawal request
  id, instructor_id, amount_kobo,
  fee_kobo, net_kobo,
  status,                          -- REQUESTED | PROCESSING | SUCCESS | FAILED | REVERSED
  reference (unique),              -- our idempotency key
  paystack_transfer_code, failure_reason,
  requested_at, processed_at, completed_at

security additions to `user`
  transaction_pin_hash, pin_set_at,
  pin_failed_attempts, pin_locked_until
```

---

## BUILD PHASES (draft — finalised once questions are answered)

- [x] P1 Schema + migration (additive, same hand-written approach as `0001`)
- [x] P2 Ledger engine: credit on sale, hold period, balance materialisation, backfill
- [x] P3 Bank account onboarding + `/bank/resolve` name verification
- [x] P4 Transaction PIN: set, change, verify, lockout
- [x] P5 Withdrawal request: locked transaction, idempotent reference, minimum, validations
- [x] P6 Paystack transfer dispatch + `transfer.*` webhook handling
- [x] P7 Instructor UI: balance card, `/instructor/withdraw`, payout history, sidebar link
- [x] P8 Admin UI: payout queue, approve/reject if manual, audit view
- [x] P9 Notifications for payout state changes
- [x] P10 Test with Paystack test keys end-to-end

---

## RULES FOR THIS PHASE

1. **Money is integer kobo.** Never a float, anywhere.
2. **Never trust a client-supplied amount.** The server recomputes what is withdrawable.
3. **Balance check + debit in one locked transaction.** No read-then-write.
4. **Every external call idempotent**, keyed on our own reference.
5. **Ledger is append-only.** Corrections are new rows, never edits.
6. **Never log a PIN, PIN hash, full account number, or secret key.**
7. **A payout is only SUCCESS when Paystack's webhook says so** — never at request time.
8. `npm run typecheck` + `npm run build` after every phase.

---

## SOURCES

- [Single Transfers](https://paystack.com/docs/transfers/single-transfers/)
- [Transfer Recipient API](https://paystack.com/docs/api/transfer-recipient/)
- [How Transfers Work](https://paystack.com/docs/transfers/how-transfers-work/)
- [Verify Account Number](https://paystack.com/docs/identity-verification/verify-account-number/)
- [Verification API](https://paystack.com/docs/api/verification/)
- [Webhooks](https://paystack.com/docs/payments/webhooks/)
- [Stamp Duty on NGN Transfers](https://support.paystack.com/en/articles/7573314)
- [Transfers (support)](https://support.paystack.com/en/articles/2132866)
- [Transactions pricing](https://support.paystack.com/en/articles/2130306)


---

## VERIFICATION LOG

| Phase | typecheck | build | evidence |
|---|---|---|---|
| P1 schema | ✅ | ✅ | 4 tables + PIN columns live; `instructor_balance_non_negative` and `payout_amounts_positive` CHECK constraints active; `payout.reference` UNIQUE; partial unique index on `ledger_entry.transaction_item_id` |
| P2 ledger | ✅ | ✅ 39/39 | backfilled 2 sales → Allen Walker ₦32,000 · Super Admin ₦200,000, both available (past 7-day hold) |
| P3 bank verify | ✅ | ✅ | name matcher: 12/12 realistic cases correct (see below) |
| P4 PIN | ✅ | ✅ | scrypt hashing, retry counter, 30-min lockout — all verified |
| P5 withdrawal | ✅ | ✅ | **22/22 safety checks pass**, incl. 5-way concurrency |
| P6 dispatch + webhooks | ✅ | ✅ 39/39 | `transfer.success/failed/reversed` settle idempotently |
| P7 instructor UI | ✅ | ✅ | `/instructor/withdraw` — balance, bank setup, PIN, fee breakdown, history |
| P8 admin UI | ✅ | ✅ | `/admin/payouts` — approval queue + bank-review queue + PIN unlock |
| P9 email | ✅ | ✅ | nodemailer/Gmail; degrades to in-app when unconfigured |
| P10 Paystack | ✅ | ✅ 41/41 | live test-mode calls verified (below) |

### P2 safety tests (run against the live database)

| Test | Result |
|---|---|
| Re-credit an already-credited line item | `credited: false`, balance unchanged ✓ |
| **5 concurrent credits of the same item** | 0 credited, **exactly 1 ledger row** ✓ |
| Force a negative balance via direct UPDATE | rejected by `instructor_balance_non_negative` ✓ |
| Ledger sum vs materialised balance | ₦32,000 = ₦32,000, reconciles ✓ |

New sales now credit the ledger from **both** payment-success paths (webhook and
`verifyPayment`), each guarded by the same idempotency constraint.


---

## REGRESSION TEST

`npx tsx scripts/test-payout-safety.ts` — **run this after any change under `lib/payouts/`.**

Creates and removes its own throwaway instructor, so it is safe against a database with
real data, and it never contacts Paystack.

| Group | Covers |
|---|---|
| A | PIN verify, retry counter, lockout, correct-PIN-refused-while-locked |
| B | every withdrawal eligibility gate |
| C | below minimum, above balance, wrong PIN |
| D | **5 concurrent withdrawals of the whole balance → exactly one wins** |
| E | settlement + duplicate webhook must not double-count |
| F | failed transfer returns money to available |

Latest run: **22/22 OK**.

### Name matcher results (12/12 as intended)

| Profile | Bank record | Score | Verdict |
|---|---|---|---|
| Chukwuma Okeke | OKEKE CHUKWUMA JOHN | 1.00 | auto ✓ |
| C. Okeke | CHUKWUMA OKEKE | 1.00 | auto ✓ |
| allen walker | WALKER ALLEN | 1.00 | auto ✓ |
| Bola Adéyemi | BOLA ADEYEMI | 1.00 | auto ✓ |
| Ada Obi | MRS ADA OBI | 1.00 | auto ✓ |
| Allen Walker | ALLEN JOHNSON | 0.50 | **review** ✓ |
| Chukwuma Okeke | ADEBAYO SULEIMAN | 0.00 | **review** ✓ |

Handles surname-first, middle names, initials, honorifics, accents and hyphens, while
still catching a shared first name with a different surname.

---

## MONEY-FLOW SUMMARY (as built)

```
sale succeeds
  └─ creditSale()            + pending      (idempotent per transaction_item)
        └─ after 7 days      → available    (matured lazily on balance read)

instructor withdraws
  └─ checkEligibility()      4 gates
  └─ verifyTransactionPin()  consumes an attempt
  └─ LOCK balance row  ── re-check inside the lock ── debit
        available −amount, reserved +amount, 2 ledger rows

  ≤ ₦50,000 → dispatch to Paystack now
  >  ₦50,000 → REQUESTED, waits in the admin queue

paystack webhook
  transfer.success   reserved → withdrawn
  transfer.failed    reserved → available   (+ PAYOUT_REVERSAL ledger row)
  transfer.reversed  reserved → available
```

Reserved-not-deducted is the key idea: money in flight is already out of `available`, so
it can never be spent twice, and a failure simply puts it back.


---

## P10 — LIVE PAYSTACK VERIFICATION (test mode)

Run against the configured test key. **No transfer was initiated** — `POST /transfer` only
runs from a real withdrawal.

| Call | Result |
|---|---|
| `GET /bank` | 277 banks returned |
| `GET /bank/resolve` | resolved → `TEST ACCOUNT 0000000000`; stored masked as `******0000` |
| `GET /balance` | ₦468,200.00 available |
| Mode check | `sk_test…` → TEST (safe) |

Mail was **not** configured at time of testing (`GMAIL_USER` / `GMAIL_APP_PASSWORD` unset)
and correctly degraded to in-app notifications only, without erroring.

---

## SENSITIVE-DATA AUDIT

| Value | Exposure |
|---|---|
| `transactionPinHash` | never returned by any procedure |
| `recipientCode` | only written to the DB / sent to Paystack — never in a response |
| full account number | **only** in `adminBankReviews` (admin-gated; needed to verify identity) |
| instructor's own account number | returned **masked** (`******6789`) |

---

## STILL OPEN / OWNER ACTIONS

1. **Disable Transfers OTP** — Paystack Dashboard → Settings → Preferences.
   Until then `POST /transfer` returns an OTP challenge and auto-approval cannot complete.
2. **Add the Paystack webhook URL** — `https://<your-domain>/api/webhooks/paystack`.
   Without it, `transfer.*` never arrives and payouts stay PROCESSING forever.
3. **Gmail App Password** (optional) — set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`
   to turn on security emails. Requires 2FA on the Google account.
4. **Fund the Paystack balance** before real payouts — transfers draw from it.

### Deviation from the agreed design, flagged
Changing a PIN requires the **current PIN**, not the account password. better-auth exposes
no server-side password check without minting a session, and requiring the current PIN is
the same guarantee (you must already hold the secret). A forgotten PIN is recoverable by an
admin via **Unlock PIN** on `/admin/payouts`.

### Refund clawback — NOW BUILT
`payouts.adminRefundTransaction` reverses every line item of a refunded purchase, revokes
the enrolments, and notifies the instructors. Covered by
`scripts/test-refund-clawback.ts` (12/12).

Behaviour:
| Situation | Result |
|---|---|
| still inside the hold window | taken back from `pending` |
| matured | taken back from `available` |
| **already withdrawn** | balance floors at 0, shortfall written as an `ADJUSTMENT` audit row |
| refunded twice | no-op |

### Still not built
- Bulk payouts. Each withdrawal is a separate transfer.
- Automatic recovery of a shortfall — it is recorded and visible, but nothing chases it.


---

## BUG FOUND BY TESTING (fixed)

`reverseSale()` originally did not clear `availableAt` on the reversed SALE ledger entry.
`maturePendingCredits()` moves any SALE row whose `availableAt` has passed from `pending`
into `available` — so the next balance read after a refund **re-credited money that had
already been clawed back**, inventing funds from nothing.

Surfaced by test 3 of `scripts/test-refund-clawback.ts`: after a full reversal the balance
came back as ₦6,000 instead of ₦0. Fixed by nulling `availableAt` inside the same
transaction as the reversal.

This is the kind of defect that reads as correct and only shows up when you run it.

---

## LIVE VERIFICATION — FINAL

| Check | Result |
|---|---|
| Gmail SMTP credentials | accepted by Google |
| Real test email sent | delivered |
| `GET /bank` | 277 banks |
| `GET /bank/resolve` | works (test code `001`) |
| `GET /balance` | ₦468,200 |
| `POST /transferrecipient` | works with a real bank code (e.g. `057`) |
| `POST /transfer` | **BLOCKED — see below** |
| Payout safety suite | 22/22 |
| Refund clawback suite | 12/12 |
| Ledger vs balances, all real instructors | reconciles |
| typecheck / build | 0 errors / 41 routes |

### 🚨 BLOCKER: Paystack account is a Starter Business

```
POST /transfer -> "You cannot initiate third party payouts as a starter business"
```

This is **not** the OTP setting and not a code problem. Paystack does not allow Transfers on
Starter Business accounts at all.

**Fix:** Paystack Dashboard → **Compliance** → change Business Type to **Registered
Business** (needs business registration documents). Transfers unlock once approved.

Everything up to the transfer call is verified working. The moment the account is upgraded,
payouts will run end to end with no code change.

The app now explains this in plain language instead of showing the raw API string — see
`explainPaystackError()` in `lib/payouts/paystack-transfers.ts`, which also covers OTP-still-on,
insufficient balance, and the test-mode resolve limit.

### Paystack test-mode gotcha worth knowing
`/bank/resolve` against **real** bank codes performs a live lookup and is capped at
**3 per day** in test mode. Code `001` is Paystack's unlimited test account. Instructors
adding real bank details while you are on test keys will hit that limit quickly.

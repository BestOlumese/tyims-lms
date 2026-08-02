# Revenue, Notifications, Search & Nav — Build Plan

Round 3. Companion to `AUDIT-NOTES.md` (bug fixes) and `IMPROVEMENT-PLAN.md` (perf/features).

Started: 2026-08-01
Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## THE CORE FINDING — read this first

**Every revenue number currently displayed is fiction.**

`instructor.getOverview` computes revenue as:

```ts
allEnrollments.forEach((en) => {
  const course = instructorCourses.find((c) => c.id === en.courseId);
  if (course) totalRevenue += course.price;   // CURRENT price, every enrolment
});
```

Verified against the live database:

| | |
|---|---|
| enrollments | **93**, all `accessType = PURCHASE` |
| transactions `status = success` | **1** (₦234,100) |
| transactions `status = pending` | 3 (₦500,780) |

So 92 enrolments were created by seed scripts with **no payment behind them**, and all 93 are
being counted as revenue. Five separate defects in that one calculation:

1. Ignores `transactions` entirely — no link to money actually received
2. Uses the course's **current** price, so editing a price rewrites historical revenue
3. Counts `GRANTED` / `SUBSCRIPTION` enrolments (free access) as sales
4. Ignores the platform's cut and the Paystack fee — gross vs net is never distinguished
5. No time dimension, so no trend, no period comparison

`admin.getPlatformOverview` is worse — it returns a literal `totalRevenue: 0` with the comment
"Placeholder until payments are integrated". Payments *are* integrated.

### Why a schema change is required
`transactions` stores `courseIds text[]` plus **one** total `amount`. A single transaction can
span courses from several instructors, and there is no per-course amount stored — so
"what did instructor X earn" is not answerable from the current tables.

`metadata` jsonb does hold a usable snapshot, which makes a backfill possible:
```json
{"courses":[{"id":"febeeecc-…","title":"Advanced JavaScript…","price":32000}]}
```
(note: `metadata.courses[].price` is in **naira**; `transactions.amount` is in **kobo**)

### Money model (confirmed)
```
buyer pays        = subtotal + paystack fee      (fee added on top, buyer absorbs it)
subtotal          = Σ effective course prices    (discountPrice if set, else price)
platform cut      = subtotal × PLATFORM_COMMISSION_PCT
instructor earns  = subtotal − platform cut
```
`calcServiceFee()` is Paystack's own processing fee (1.5% + ₦100 over ₦2,500, % capped ₦2,000).
It is **not** platform profit — it goes to Paystack.

> ⚠️ Instructor payouts are not implemented. `users.paystackSubaccountCode` exists in the schema
> but nothing uses it — `initializeTransaction` never sets a subaccount, so 100% of every payment
> lands in the platform account. The dashboards will show what an instructor has *earned*; actually
> paying them out is a separate piece of work. Flagged, not in scope here.

---

## DECISIONS LOCKED (confirmed by owner)

| Topic | Decision |
|---|---|
| Platform commission | **Configurable**, default 0% — `PLATFORM_COMMISSION_PCT` |
| Revenue basis | **Successful transactions only** (dashboards will show real, smaller numbers) |
| Schema | **Add `transaction_items`** + migration + backfill from `metadata` |
| Nav dropdown | Admin → all 3 dashboards · Instructor → 2 · Student → 1 |
| Notification events | Admin: payment succeeded / failed / instructor application. Instructor: course purchased / new review |
| Notification delivery | In-app bell, DB-backed, polled |
| Search | Role-scoped; admin = users/courses/categories/transactions, instructor = own courses/students/reviews |
| Revenue page | Full analytics **+ CSV export** |

---

## PHASE A — Schema

- [x] A1 `transaction_items` table
      `id, transaction_id, course_id, instructor_id, unit_price_kobo, platform_fee_kobo,
       instructor_earning_kobo, created_at`
      Indexes on `instructor_id`, `course_id`, `transaction_id`.
      `instructor_id` is snapshotted at purchase time so reassigning a course later cannot
      rewrite historical earnings.
- [x] A2 `notification` table
      `id, recipient_id, type, title, body, link, entity_type, entity_id, actor_id,
       read_at, created_at`. Index on `(recipient_id, read_at)`.
- [x] A3 `notification_type` enum
- [x] A4 Generate migration (`npm run db:generate`) — **review the SQL before applying**
- [x] A5 Backfill script: existing successful transactions → `transaction_items`, deriving
      per-course price from `metadata.courses[].price` (naira → kobo)

## PHASE B — Revenue engine

- [x] B1 `lib/revenue.ts` — commission config + the single money-math helper everything uses
- [x] B2 Write `transaction_items` rows at checkout (`initializePayment`)
- [x] B3 Count them only when the parent transaction reaches `success`
      (both the webhook and `verifyPayment` paths)
- [x] B4 Replace `instructor.getOverview` revenue with the real calculation
- [x] B5 Replace `admin.getPlatformOverview` `totalRevenue: 0`
- [x] B6 Analytics procedures: revenue over time, top courses, recent transactions,
      per-instructor split (admin only)

## PHASE C — Revenue pages

- [x] C1 `/instructor/revenue` — own earnings only
- [x] C2 `/admin/revenue` — platform-wide + per-instructor
- [x] C3 KPI row, time-series chart, top courses, transactions table, date-range filter
- [x] C4 CSV export of the filtered transaction list
- [x] C5 Add to both sidebars

## PHASE D — Notifications

- [x] D1 `lib/notifications.ts` — `notify()` helper, one place that writes rows
- [x] D2 Emit at: paystack webhook (success/failure), `verifyPayment`, `requestInstructor`,
      `handleInstructorRequest`, `submitReview`
- [x] D3 Procedures: list (paginated), unread count, mark read, mark all read
- [x] D4 Bell UI — **replaces the hardcoded fake list currently in `components/admin/top-bar.tsx`**
      (3 fabricated "New Instructor joined" items and a fake "4 New" badge)
- [x] D5 Poll for unread count

## PHASE E — Search

- [x] E1 `search` procedure, role-scoped server-side (an instructor must never be able to
      reach another instructor's rows)
- [x] E2 Wire up the top-bar input, debounced, grouped results, keyboard navigation

## PHASE F — Nav dropdown  ← quick win, do first

- [x] F1 Cross-role links in the header dropdown
- [x] F2 Same in mobile nav

---

## RULES

1. `npm run typecheck` + `npm run build` after every phase. Verify, don't assume.
2. **Do not restyle anything.** The redesign was rejected and reverted; match the existing look.
3. All money in **kobo** (integers) in the DB. Convert at the edges only. Never float-multiply money.
4. Revenue counts `status = 'success'` transactions only.
5. Role-scope every new query server-side. Never filter by role in the client.
6. Review generated migration SQL before applying it to the database.

---

## VERIFICATION LOG

| Phase | typecheck | build | notes |
|---|---|---|---|
| baseline | ✅ | ✅ 37/37 | after redesign revert |
| F — nav dropdown | ✅ | ✅ | cross-role links; also fixed `flaticon-online-learning` (10 uses, invisible glyph) |
| A — schema | ✅ | ✅ | `transaction_item` + `notification` applied to live DB, verified; backfill 7 line items, all reconciled |
| B — revenue engine | ✅ | ✅ | verified vs real data: gross ₦232,000 split Allen Walker ₦32,000 / Super Admin ₦200,000 |
| D — notifications | ✅ | ✅ 37/37 | real bell replaces 3 hardcoded fake items + fake "4 New" badge |
| B6 — analytics | ✅ | ✅ | verified: sum(instructors) reconciles to admin gross; instructor scoping leaks nothing |
| C — revenue pages | ✅ | ✅ 39/39 | /admin/revenue + /instructor/revenue, chart + CSV, added to both sidebars |
| E — search | ✅ | ✅ | role-scoped server-side; replaces the dead top-bar input |
| CSS root split | ✅ | ✅ 39/39 | `/` loads 560KB template chunk, `/admin/login` loads only 76KB Tailwind chunk — never shared |


---

## THE CSS BLEED FIX (multiple root layouts)

**Symptom:** clicking a dashboard link from the homepage rendered the dashboard unstyled;
a manual refresh fixed it.

**Cause — not a Next.js bug.** `(student)` and `(dashboards)` shared one root layout, so
moving between them was a *soft* navigation, and React never removes a stylesheet it has
hoisted. Arriving at /admin from the homepage left ~570KB of Bootstrap + Upskill CSS in the
document — **2,098 `!important` declarations** (1,715 Bootstrap + 383 template), bare-element
rules on `html, body, h1–h6, p, a, ul, li, button, input`, and its own `.flex`,
`.block`, `.hidden`, `.items-center`, `.justify-center`, `.gap-10` colliding with Tailwind's
identically-named utilities. It bled the other way too: leaving a dashboard carried
Tailwind's preflight onto the template pages.

**Fix:** split into multiple root layouts. Next.js forces a **full page load** when
navigating across root layouts, so the two stylesheets can never coexist.

```
app/(student)/layout.tsx     ROOT · globals.css + template-theme.css
app/(auth)/layout.tsx        ROOT · globals.css + template-theme.css
app/(learn)/layout.tsx       ROOT · globals.css + template-theme.css
app/(dashboards)/layout.tsx  ROOT · globals.css + dashboard.css
app/admin/layout.tsx         ROOT · globals.css + dashboard.css   (for /admin/login only —
                                    it can't live in (dashboards), whose layout redirects
                                    anyone without a session)
components/root-shell.tsx    shared <html>/<body> + fonts + providers
app/global-not-found.tsx     the 404 (multiple roots means no single layout to compose
                             one from — needs experimental.globalNotFound in next.config)
```

⚠️ **Do not reintroduce `app/layout.tsx`.** A single root collapses these back together and
the bug returns immediately.

Verified in the build output: `/` and `/about` load the 560KB template chunk;
`/admin/login` loads only the 76KB Tailwind chunk. No route loads both.

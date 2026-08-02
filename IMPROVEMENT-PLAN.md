# TYIMS LMS — Improvement Plan (Round 2)

Working tracker for the performance + design + feature pass.
Companion to `AUDIT-NOTES.md` (round 1: bug fixes — build now passes).

Started: 2026-08-01

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked/needs decision

---

## DECISIONS LOCKED (confirmed by owner)

| Topic | Decision |
|---|---|
| Dashboard visual direction | **Adopt the Upskill template tokens** — navy `#131836`, terracotta `#E27447`, Cardo + DM Sans |
| Redesign approach | **Design system first**, then cascade screens onto shared primitives |
| Become an Instructor | Form collects **title + about me**; **login required**; sets `PENDING` |
| Nav placement | Header nav **+** mobile nav **+** homepage CTA **+** footer |
| Performance scope | **Public pages + header** (homepage, /instructors, /courses, category dropdown) |
| Homepage instructors | **Top-rated, must have ≥1 PUBLISHED course**; hide section if none |
| Fonts | **Self-host via next/font** (Cardo + DM Sans); drop unused Geist |

---

## DESIGN TOKENS — the single source of truth

Extracted from `public/css/template-main.css` `:root`. These are the real values the
purchased template uses; the dashboards must match them.

```
--Primary    #131836   deep navy    (primary actions, headings, sidebar)
--Secondary  #E27447   terracotta   (accent, active state, highlights)
--Border     #E4E4E7   hairline borders
--Soft-Text  #585D69   secondary/muted text
--bg-1       #F3F3F3   neutral surface
--bg-2       #E9DECE   warm sand
--bg-3       #D7C7EA   lilac
--bg-4       #FFEFEA   pale peach (pairs with Secondary)
--bg-5       #F5F5F2   off-white page background
```

Typography: **Cardo** (serif, headings — the `.font-cardo` class) · **DM Sans** (body/UI) · Outfit (rare)

### What currently reads as "AI slop" — the specific tells to remove
1. `indigo-600` (#4f46e5) — Vercel/shadcn default, unrelated to the brand
2. `Geist` / `Geist_Mono` — Vercel default fonts, loaded globally but only used in dashboards
3. Coloured drop shadows: `shadow-lg shadow-indigo-100` / `shadow-indigo-200`
4. `rounded-2xl` on every surface regardless of size or role
5. Arbitrary type sizes — `text-[15px]`, `text-[13px]`, `text-[12px]`, `text-[11px]` with no scale
6. `animate-in fade-in duration-500` on every page wrapper
7. Pastel icon tiles (`bg-indigo-50 text-indigo-600` rounded squares) on every heading
8. `uppercase tracking-widest` micro-labels used decoratively

---

## PHASE 1 — "Become an Instructor" (feature does not exist yet)

**Finding: there is no way for a user to apply.** `instructorRequestStatus` defaults to `IDLE`
and nothing in the codebase ever sets it to `PENDING`. The admin Applications screen
(`getPendingInstructors` / `handleInstructorRequest`) is fully built but can only ever be empty.
This is the missing half.

Existing pieces to connect to:
- `users.instructorRequestStatus` — enum `IDLE | PENDING | APPROVED | REJECTED`
- `users.title`, `users.aboutMe` — already columns, already shown on the public instructor profile
- `admin.getPendingInstructors` — reads `role = STUDENT AND status IN (PENDING, REJECTED)`
- `admin.handleInstructorRequest` — APPROVE sets `role = INSTRUCTOR`, `status = APPROVED`

- [x] 1.1 `student.requestInstructor` procedure — validates title + aboutMe, sets `PENDING`
- [x] 1.2 `student.getInstructorApplication` — returns current status for gating the UI
- [x] 1.3 Fix: `handleInstructorRequest` doesn't bump `updatedAt`, but `getPendingInstructors`
       orders by it — approvals/rejections don't reorder. Set `updatedAt` on write.
- [x] 1.4 `/become-instructor` page + client form
- [x] 1.5 State machine in the UI:
       - logged out → send to `/register?next=/become-instructor`
       - `STUDENT` + `IDLE` → show form
       - `PENDING` → "under review" state, form hidden
       - `REJECTED` → allow re-apply
       - `INSTRUCTOR` / `ADMIN` → redirect to `/instructor`
- [x] 1.6 Nav: header (`Nav.jsx`), mobile (`MobileNav.jsx`), footer (`Footer1`), homepage CTA
       (`BecomeInstactor.jsx` — currently a dead `<a href="#">`)

---

## PHASE 2 — Homepage instructors from the DB

`upskill/components/homes/home-1/Instractors.jsx` renders the static
`@/upskill/data/instractors` array.

**Also broken — both links 404:**
- card → `/instructor-single/${id}` · real route is `/instructors/[id]`
- "See All Instructors" → `/instructor-list` · real route is `/instructors`

- [x] 2.1 `getFeaturedInstructors` procedure — `role = INSTRUCTOR`, `≥1 PUBLISHED course`,
       order by avgRating desc, studentCount desc, limit 8
- [x] 2.2 Rewrite `Instractors.jsx` to take data as a prop (server-fetched)
- [x] 2.3 Hide the whole section when there are no qualifying instructors
- [x] 2.4 Fix both broken hrefs
- [x] 2.5 Real avatar fallback when `users.image` is null

---

## PHASE 3 — Performance (public pages + header)

**Current problem:** ~30 components fetch with `useQuery` on the client. A page ships an empty
shell → hydrates → fires `/api/orpc` → renders. That's a three-hop waterfall on first paint.

Evidence from the build: `/instructors` is marked `○ (Static)` yet lists DB data — it has
**zero** server-side fetching. The header's category dropdown refetches on every route, which is
why `app/globals.css` needs the `#header_main .header-catalog ul:empty { display: none }` hack.

- [x] 3.1 Add `dehydrate`/`HydrationBoundary` support to `components/providers.tsx`
- [x] 3.2 Homepage: server-prefetch courses + featured instructors
- [x] 3.3 `/instructors`: server-prefetch first page (currently none at all)
- [x] 3.4 Header categories: fetch once in the layout, pass down — then delete the
       `ul:empty` hack from `globals.css`
- [x] 3.5 Review `staleTime` / caching per query
- [x] 3.6 Re-check static vs dynamic per route after the changes

Out of scope this round (owner's call): the 20+ admin/instructor screens.

---

## PHASE 4 — Dashboard redesign — **REVERTED**

Attempted the template-token redesign (navy/terracotta, shared DashboardShell, UI primitives,
scripted migration of ~1,990 class occurrences across 30 files). The owner reviewed it and
rejected it: wrong colours, poor text contrast, and things looked broken.

**Reverted to the original indigo/grey styling on 2026-08-01.** All dashboard files were
restored from HEAD, then the round-1 bug fixes that lived in those same files were re-applied
by hand (see below).

### Why it went wrong — do not repeat this
I ran a scripted class migration across 30 files and verified only that it **compiled**.
I never rendered a single screen. Consistency of the substitution is not evidence that the
result looks right. Any future restyle must be reviewed on a running page, screen by screen,
before it spreads past one file.

### What survived the revert (deliberately kept)
- `components/auth/login-form.tsx` — original styling restored, but:
  - the **"Test Accounts" panel publishing `admin@lms.com` / `password123` stays deleted**
  - sign-in now routes by role (`/admin`, `/instructor`, `/dashboard`) instead of always `/`
- `app/(dashboards)/dashboard.css` — `--font-sans` repointed from the removed Geist to DM Sans
- Re-applied round-1 fixes: `ConfirmModal.confirmationText`, `loading`→`isLoading` on two
  delete modals, three `prefer-const`, `newLessons: any[]`, the UploadThing `input` cast,
  and removal of 5 client-side `console.log` calls

### Kept for reference
The full restyle is saved as a patch (not applied) at
`<scratch>/restyled-backup/restyle.patch`, plus the `components/ui` and
`components/dashboard` primitives. Re-applyable if a future palette is agreed.

### Still open
- [!] Dashboard visual direction — needs a decision, then a **screen-by-screen** review
- [ ] Fake UI still present in `components/admin/top-bar.tsx`: hardcoded notifications
      ("New Instructor joined" ×3, a "4 New" badge) and a search box wired to nothing

---

## PHASE 5 — Fonts

- [ ] 5.1 Load Cardo + DM Sans via `next/font/google`
- [ ] 5.2 Remove `Geist` / `Geist_Mono` from `app/layout.tsx` (unused after Phase 4)
- [ ] 5.3 Stop `public/font/fonts.css` hotlinking 18 files from `fonts.gstatic.com`
- [ ] 5.4 Verify `.font-cardo` and template headings still resolve

---

## RULES FOR THIS PASS (do not violate)

1. **`npm run build` and `npm run typecheck` must pass after every phase.** Verify, don't assume.
2. **Do not put template CSS into `app/globals.css`** — it would leak Bootstrap's reboot into the
   Tailwind dashboards. `app/template-theme.css` is imported only by the 4 template-shell entries.
3. `flex` / `items-center` / `justify-center` / `gap-10` in student pages are **template
   utilities**, not Tailwind. Leave them alone.
4. `proxy.ts` is the correct Next 16 name for middleware. Do not rename.
5. Preserve template markup/classnames when making a component dynamic — the CSS depends on the
   exact class structure.
6. Don't mass-fix the 207 pre-existing lint errors; that risk was already declined.

---

## VERIFICATION LOG

| Phase | typecheck | build | notes |
|---|---|---|---|
| round 1 baseline | ✅ 0 errors | ✅ 36/36 pages | starting point |
| Phase 1 — apply flow | ✅ | — | `getFeaturedInstructors` also run against the real DB: 8 rows |
| Phase 2 — dynamic instructors | ✅ | ✅ 37/37 | homepage instructor names confirmed in prerendered HTML |
| Phase 4 — redesign | ✅ | ✅ | **rejected by owner, reverted**; fixes re-applied, build 37/37 |
| Phase 5 — fonts | ✅ | ✅ 37/37 | self-hosted; 0 gstatic refs, 21 woff2 emitted |
| Phase 3 — prefetch | ✅ | ✅ 37/37 | `/` + `/instructors` now ○ Static w/ 5m revalidate; 83 category links server-rendered on `/login`; `ul:empty` hack deleted |

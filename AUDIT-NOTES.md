# TYIMS LMS — Audit & Working Notes

> Living reference doc. Everything below was **verified against the actual code** — built, type-checked,
> or HTTP-tested — not guessed.

Audit date: 2026-07-31
Stack: **Next.js 16.2.4 (Turbopack, App Router)**, React 19.2.4, Drizzle + Postgres, better-auth,
oRPC + TanStack Query, Mux, UploadThing, Paystack, Inngest, Tailwind v4 (dashboards only),
Bootstrap 5 + Upskill template.

**Current state: `npm run build` passes. `npm run typecheck` passes (0 errors).**
Before this pass, the build failed and could not be deployed at all.

---

## ✅ WHAT WAS FIXED

### A. Build was completely broken
`npm run build` failed on a type error. It was not one bug but a queue of them — each fix revealed
the next, because `next build` stops at the first failure.

| Fix | File |
|---|---|
| `breadcrumbs` prop inferred as `never[]` from an untyped JSX default | `upskill/components/course-list/PageTitle.jsx` (added JSDoc types) |
| `CourseListClient` props inferred as `null \| undefined` | `components/students/CourseListClient.jsx` (added JSDoc types) |
| `ConfirmModal` had no `confirmationText` prop, but 2 call sites passed it | `components/shared/confirm-modal.tsx` |
| `curriculum-builder` — `item` is of type `unknown` | `components/instructor/curriculum-builder.tsx` |
| `upload-area` — `input` prop rejected because `endpoint` is typed `any` | `components/shared/upload-area.tsx` |
| `bootstrap.esm` / `wowjs` had no type declarations | new `types/vendor.d.ts` |
| `seed-assessments.ts` had its entire import block duplicated | `scripts/seed-assessments.ts` |
| 12 × `new ORPCError({ code, message })` used the wrong signature | `server/api/root.ts` |
| `test_query.ts` was corrupt (UTF-16 garbage) — the sole `tsc` blocker | deleted |

### B. Real runtime bugs (would have hit the customer)

1. **`/help-center` returned a 500 in production.** A Server Component passed
   `onClick={(e) => e.preventDefault()}` to a `<button>`, which crashes React's RSC serializer
   ("Event handlers cannot be passed to Client Component props"). The whole route failed to render.
   → Extracted to `components/students/HelpCenterSearch.jsx`. While fixing it, the form now actually
   searches the catalogue (`/courses?q=…`) instead of swallowing the submit.

2. **Mux video processing was calling a removed API.** `@mux/mux-node` v14 requires `inputs`
   (plural) and `playback_policies`; the code passed the deprecated `input` / `playback_policy`.
   → `lib/inngest/functions.ts`

3. **The admin could never log in.** `proxy.ts` guarded `/admin/:path*` and redirected any
   non-admin to `/`. `/admin/login` matches that pattern, so the login page bounced logged-out
   admins away from the only page that could log them in.
   → Added a `PUBLIC_EXCEPTIONS` allowlist; unauthenticated `/admin/*` now redirects **to**
   `/admin/login` instead of `/`.

4. **A redirect pointed at a 404.** `proxy.ts` sent non-instructors to `/student/dashboard`,
   which has never existed. → now `/dashboard`.

5. **Unpublished courses leaked onto the public `/courses` page.** The server-rendered query was a
   hand-written copy of `getPublicCourses` that had drifted: it was missing the
   `status = 'PUBLISHED'` filter, so DRAFT and ARCHIVED courses appeared on first paint before the
   client query replaced them.
   → Both `/courses` and `/category/[slug]` now call the real procedure via `call()` from
   `@orpc/server`, so the SSR and client results can never diverge again.

6. **Delete buttons never disabled themselves.** Two admin screens passed `loading={…}` but the
   modal's prop is `isLoading`, so the spinner never showed and the button stayed clickable during
   the request — a double-submit waiting to happen.
   → `components/admin/categories-client.tsx`, `components/admin/courses-client.tsx`

7. **Unknown category slugs rendered a blank page** titled "Category" instead of a 404.
   → `notFound()` in `app/(student)/category/[slug]/page.tsx`

### C. The template loading problem ← your main complaint

**Root cause found.** `public/scss/main.scss` had been edited to use *absolute* import paths:

```scss
@import "/css/bootstrap.css";                              // Sass cannot resolve this
@import "node_modules/react-modal-video/scss/modal-video.scss";
```

The original template uses relative paths that compile fine. Once the SCSS build broke, someone
compiled it by hand into `public/css/template-main.css` and wired up runtime `<link>` tags as a
workaround. **That workaround was the flash of unstyled content.**

Why those `<link>` tags flashed: React 19 only hoists `<link rel="stylesheet">` into `<head>` and
render-blocks on it when the tag carries a `precedence` prop. Without it, React leaves the tag
where it sits in the body, so the browser discovers ~700 KB of CSS *after* it has already begun
painting.

**The fix:** all nine stylesheets now route through the Next build via `app/template-theme.css`,
imported by the four template-shell entry points.

| | Before | After |
|---|---|---|
| Requests | 9 | 2 |
| Total CSS | 796,505 bytes | 569,512 bytes (**−227 KB**) |
| Minified | no | yes |
| Content-hashed (cacheable) | no | yes |
| In `<head>`, render-blocking | **no → FOUC** | yes (`data-precedence="next"`) |
| Duplicated across files | 4 copies | 1 |

Verified in the build output — `.next/server/app/about.html` now contains
`<link rel="stylesheet" href="/_next/static/chunks/…css" data-precedence="next"/>`
and **zero** `/css/*` references.

All 18 `url()` asset references inside those stylesheets were checked to resolve before bundling —
fonts, icon files and background images all still load.

> ⚠️ Deliberate: `template-theme.css` is **not** imported into `app/globals.css`. The `(dashboards)`
> routes are Tailwind-based and pulling Bootstrap's reboot in there would wreck them.

### D. Broken images

Hotlinked Unsplash URLs had replaced the template's bundled images. **Two were hard 404s**
(verified by HTTP request) — both on the homepage, the first thing a visitor sees:

- `photo-1545996124-1b3b5e8f3b3b` → **404**, used twice in the homepage hero
- `photo-1554774853-ae20a2e1f47c` → **404**, hero slide 3

Several also carried a fabricated `&s=1a2b3c4d` signature parameter.

**All 7 hotlinks are now local template assets.** No external image dependency remains:
- hero avatars → `/images/avatar/user-1…3.png`
- main hero → `/images/page-title/page-title-home1.png` (exactly 960×1161, matching the
  hardcoded `<Image width/height>` — this is the template's original home-1 hero)
- slides → `/images/page-title/page-title-home9.jpg`, `-home91.jpg`, `-home10.jpg`

Customisations were preserved (`btnHref: "/courses"`, the reworded headings, real `imgAlt` text).

### E. `/categories` rendered unstyled
`CategoriesList.jsx` used Tailwind classes (`grid-cols-*`, `gap-6`, `text-zinc-500`, `rounded-xl`)
on a student route. **Tailwind is only imported by `app/(dashboards)/dashboard.css`**, so on
student routes those classes resolve to nothing and the page rendered as a bare vertical stack.
→ Rebuilt on Bootstrap's grid + the template's own `categories-item` card. Also added proper
loading skeletons and an error state.

> ⚠️ Careful: `flex`, `items-center`, `justify-center`, `gap-10` **do** exist in the Upskill CSS
> (it ships its own Tailwind-lookalike utilities). Those usages across the student pages are
> correct — do not "fix" them.

### F. Dead code & duplication removed
- `data/` — 18 files, a stale copy of the template's originals; **zero** imports of `@/data/`
- `utils/template/` — byte-identical to `upskill/utlis/`; **zero** imports of `@/utils/`
- `components/instructors/InstructorProfileClient.jsx` — unimported, and pointed at
  `/images/avatar-placeholder.png` which doesn't exist
- `scratch/` — 4 throwaway scripts
- empty leftover `context/` and `inngest/` directories
- root junk: `test_query.ts`, `test-orpc.ts`, `fix_imports.js`, `fix_imports_double.js`,
  `out.txt`, `tsc-errors.log`, `build_log.txt`, `seed_output.txt`, `migrate-manual.ts`

### G. Config & hygiene
- **`NEXT_PUBLIC_APP_URL` was referenced but never defined** — server-side oRPC calls silently
  fell back to `http://localhost:3000`, which breaks any deployed build. Added to `.env`, plus a
  `VERCEL_URL` fallback in `lib/orpc.ts`.
- Created **`.env.example`** documenting all 11 variables (and `!.env.example` in `.gitignore`).
- **`"lint": "next lint"` was dead** — `next lint` was removed in Next 16. Now `eslint .`.
  Added `"typecheck": "tsc --noEmit"`.
- `@better-fetch/fetch` is imported by `proxy.ts` but was only a transitive dep → added as a
  direct dependency.
- Removed 5 client-side `console.log` calls that leaked to the browser console.
  **Server-side logs were kept** — they're legitimate operational logging for the
  Inngest/UploadThing/Mux pipelines.
- `.gitignore` now covers build/debug output.

---

## ⚠️ THINGS THAT ARE FINE — DO NOT "FIX"

- **`proxy.ts` is correctly named.** Next.js 16 renamed `middleware.ts` → `proxy.ts`. Confirmed in
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
  Do not rename it back.
- `flex` / `items-center` / `justify-center` / `gap-10` in student components — template utilities.
- `.env` is correctly gitignored and not tracked.
- Image null-guards: every `thumbnailUrl` / `user.image` / `instructor.image` render site already
  has a proper fallback block. I checked all 12 — no change needed.

---

## 📋 REMAINING — needs your decision

### 1. `components/admin/admin-categories-client.tsx` is dead
Provably unimported (`app/(dashboards)/admin/categories/page.tsx` imports `categories-client.tsx`
instead). It's a near-duplicate carrying 8 lint errors. **I left it in place** because it wasn't in
the deletion list you approved. Say the word and it goes.

### 2. `app/api/seed/route.ts`
Creates `admin@lms.com` / `instructor@lms.com` / `student@lms.com`, all with password
`password123`. It *is* guarded by `NODE_ENV === "production"`, so it's not exploitable on a
production deploy — but it shouldn't ship in a customer deliverable. Recommend deleting before
handover.

### 3. Lint: 207 errors / 294 warnings (pre-existing, non-blocking)
`next build` does not run ESLint in Next 16, so none of this blocks shipping. I deliberately did
**not** mass-fix these — bulk refactors are exactly how regressions get introduced, and you said
you don't have time to re-test. Breakdown:

| Count | Rule | Risk to fix |
|---|---|---|
| 115 | `@typescript-eslint/no-explicit-any` | Medium — needs real types, touches many files |
| 37 | `react-hooks/set-state-in-effect` | **High** — genuine anti-pattern, but changing effect timing can alter behaviour |
| 31 | `react/no-unescaped-entities` | Low — cosmetic |
| 13 | `react-hooks/static-components` | Medium — components declared inside components; can cause remounts/lost input focus |
| 6 | `@typescript-eslint/no-require-imports` | Low |

Only the 3 mechanical `prefer-const` errors were fixed.

### 4. `server/api/root.ts` is 1,800 lines
Admin + instructor + student + public procedures in one file. It works; it's the main
maintainability risk. Splitting is safe but touches a lot — worth doing *after* handover.

### 5. Known placeholders still in the data
- `server/api/root.ts:438` — `totalRevenue: 0 // Placeholder until payments are integrated`.
  Paystack **is** integrated, so the admin dashboard permanently shows ₦0 revenue.
- `server/api/root.ts:607` — `recentEnrollments: [] // TODO`
- `next.config.ts` `remotePatterns` still allowlists `cloudflare-ipfs.com`, `cdn.jsdelivr.net`,
  `api.dicebear.com`, `randomuser.me`, `i.pravatar.cc` — only ever used by seed scripts. Harmless,
  but they can go once seeded data is replaced with real content.
- Seed scripts still hotlink Unsplash/randomuser/dicebear. Fine for dev; the data they write into
  the DB will show those URLs in the UI, so replace seeded content before handover.

### 6. `UploadArea` types
`endpoint` is typed `any`, which defeats UploadThing's route narrowing — that's why the valid
`input={{ lessonId }}` had to be cast. Making `UploadArea` generic over the router would restore
type safety. Runtime behaviour is correct either way.

---

## 🔁 HOW TO VERIFY

```bash
npm run typecheck   # must print nothing (0 errors)
npm run build       # must reach "Generating static pages (36/36)"
npm run dev         # then check: /, /courses, /categories, /help-center, /admin/login
```

Pages worth eyeballing after any CSS change: `/` (hero images), `/categories` (rebuilt markup),
`/help-center` (rebuilt search form), `/admin/login` (was unreachable), and any 404 URL.

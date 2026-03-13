---
phase: 02-auth-migration
plan: "03"
subsystem: auth
tags: [supabase-auth, sign-in, sign-up, email-confirmation, pkce, pending]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [auth-views-supabase, email-confirm-route, pending-page]
  affects: [sign-in-view, sign-up-view, auth-page-guards]
tech_stack:
  added: []
  patterns: [supabase-auth-direct, pkce-email-confirmation, inline-error-state]
key_files:
  modified:
    - src/modules/auth/ui/views/sign-in-view.tsx
    - src/modules/auth/ui/views/sign-up-view.tsx
    - src/app/(app)/(auth)/sign-in/page.tsx
    - src/app/(app)/(auth)/sign-up/page.tsx
  created:
    - src/app/auth/confirm/route.ts
    - src/app/(app)/pending/page.tsx
decisions:
  - "tenants.stripe_account_id is NOT NULL with no default — insert empty string placeholder until Stripe onboarding (Phase 4)"
  - "tenants has no user_id column — inserted into user_tenants join table after tenant creation in confirm route"
  - "sign-up-view shows inline check-email screen (confirmationSent state) instead of redirect, avoiding flash on email verify"
metrics:
  duration: ~8 min
  completed: 2026-03-06
  tasks_completed: 2
  files_changed: 6
---

# Phase 02 Plan 03: Supabase Auth Views, Confirm Route, Pending Page — Summary

**One-liner:** Rewired sign-in/sign-up to call Supabase Auth directly, added PKCE email-confirm route that creates a pending tenant, and added /pending waiting page.

## What Was Done

### Task 1 — Rewire auth views to call Supabase directly

**sign-in-view.tsx:**
- Removed `useTRPC`, `useMutation`, `useQueryClient`, and all tRPC/tanstack-query imports
- Added `useState` for `authError` and `isPending`
- Replaced the `login` mutation with an async `onSubmit` that calls `supabase.auth.signInWithPassword`
- Redirects to `/` on success; shows inline red error on failure
- JSX layout unchanged

**sign-up-view.tsx:**
- Removed all tRPC imports
- Added `authError`, `isPending`, `confirmationSent` state
- Replaced `register` mutation with async `onSubmit` calling `supabase.auth.signUp` with `options.data.shop_name`
- When `confirmationSent` is true, renders a check-your-email screen in the same layout shell
- Renamed `username` field references to `shopName`; updated preview URL from `{username}.shop.com` to `{shopName}.ferment.com`
- Added inline error display below password field

### Task 2 — Page guards, confirm route, pending page

**sign-in/page.tsx and sign-up/page.tsx:**
- Removed `caller` import and `caller.auth.session()` call
- Replaced with `await createClient()` + `supabase.auth.getUser()` guard
- `export const dynamic = "force-dynamic"` retained

**src/app/auth/confirm/route.ts (new):**
- PKCE email confirmation GET handler
- Calls `supabase.auth.verifyOtp({ type, token_hash })`
- Derives slug from `user_metadata.shop_name`; de-duplicates with 4-char random suffix if slug taken
- Inserts tenant row with `status: 'pending'` and empty `stripe_account_id` placeholder
- Inserts `user_tenants` row to link the tenant to the confirming user
- Redirects to `/pending` on success, `/sign-in?error=confirmation_failed` on failure

**src/app/(app)/pending/page.tsx (new):**
- Static page with "Your application is under review" message
- Styled with `#F4F4F0` background matching auth layout
- Returns link to marketplace

## Files Changed

| File | Status |
|------|--------|
| `src/modules/auth/ui/views/sign-in-view.tsx` | Modified |
| `src/modules/auth/ui/views/sign-up-view.tsx` | Modified |
| `src/app/(app)/(auth)/sign-in/page.tsx` | Modified |
| `src/app/(app)/(auth)/sign-up/page.tsx` | Modified |
| `src/app/auth/confirm/route.ts` | Created |
| `src/app/(app)/pending/page.tsx` | Created |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tenants.stripe_account_id is NOT NULL with no default**
- **Found during:** Task 2 — reading `src/lib/supabase/types.ts` before writing the insert
- **Issue:** The plan's confirm route insert did not include `stripe_account_id`, but the types file shows `Insert.stripe_account_id: string` (required, no `?`). The insert would fail at runtime with a DB constraint error.
- **Fix:** Insert `stripe_account_id: ""` as a placeholder. This will be replaced with a real Stripe account ID during Phase 4 Stripe onboarding.
- **Files modified:** `src/app/auth/confirm/route.ts`
- **Commit:** 6aade44

**2. [Rule 1 - Bug] tenants has no user_id column — plan insert would silently drop the user link**
- **Found during:** Task 2 — reading `src/lib/supabase/types.ts`
- **Issue:** The plan's insert included `user_id: data.user.id` on the tenants table, but the tenants Row/Insert types have no such column. The relationship is via the `user_tenants` join table.
- **Fix:** After inserting the tenant, insert a `user_tenants` row with `{ tenant_id, user_id }`.
- **Files modified:** `src/app/auth/confirm/route.ts`
- **Commit:** 6aade44

### Pre-existing Out-of-Scope Errors

`ctx.db` TypeScript errors exist across `categories`, `checkout`, `reviews`, `tags`, `tenants`, and `products` procedure files. These are pre-existing Payload/Prisma references being migrated in later phases. They are unaffected by Plan 03 changes and deferred to their respective migration plans.

## Key Decisions / Notes

- **stripe_account_id placeholder:** Using `""` rather than a random value to make it easy to detect un-onboarded tenants in Phase 4 (`WHERE stripe_account_id = ''`).
- **user_tenants insert:** Done after the tenant insert. If tenant insert succeeds but user_tenants fails, the tenant becomes orphaned — acceptable for this phase given the low-traffic onboarding flow. A transaction would require RPC, which is out of scope here.
- **confirmationSent screen:** Rendered inline in the sign-up view (state flip) rather than a separate route. Keeps the single-page flow and avoids exposing a `/check-email` route that could be navigated to directly.

## Verification Result

TypeScript check (`npx tsc --noEmit`) on Plan 03 files: **zero errors**.

Full project check shows pre-existing `ctx.db` errors across other modules (categories, checkout, reviews, tags, tenants, products). These errors are unchanged from before Plan 03 and belong to future migration phases.

Manual verification checklist:
1. sign-in-view calls `supabase.auth.signInWithPassword()` directly — no tRPC: **DONE**
2. sign-up-view calls `supabase.auth.signUp()` with `options.data.shop_name` — no tRPC: **DONE**
3. Both page.tsx guards use `createClient()` + `getUser()` — no caller import: **DONE**
4. `/auth/confirm/route.ts` exists, calls `verifyOtp()`, creates pending tenant row, redirects to `/pending`: **DONE** (with user_tenants fix)
5. `/pending` page exists with meaningful waiting message: **DONE**

## Commits

- `cb0b553` feat(02-03): rewire sign-in and sign-up views to call Supabase directly
- `6aade44` feat(02-03): update page guards, add /auth/confirm route and /pending page

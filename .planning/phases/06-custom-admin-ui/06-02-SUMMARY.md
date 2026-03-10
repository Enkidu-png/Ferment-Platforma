---
phase: 06-custom-admin-ui
plan: 02
subsystem: ui
tags: [trpc, react, shadcn, supabase, admin, merchant-approval]

# Dependency graph
requires:
  - phase: 06-01
    provides: adminProcedure middleware, admin layout guard, admin sidebar nav
  - phase: 05-storage-migration
    provides: media table with image URLs for product carousel
  - phase: 03-seed-and-verify
    provides: user_tenants junction table, seeded merchants with products

provides:
  - tenantsRouter extended with adminGetTenants, adminApproveTenant, adminRejectTenant, adminUndoTenantDecision
  - AdminTenantRow type with email resolved from auth.users via supabaseAdmin.auth.admin.listUsers()
  - MerchantReviewCard: Tinder-style card with product photo carousel, email display, 4 action buttons
  - MerchantsView: Pending/Approved tab UI with card queue and undo stack
  - /admin/merchants page (default landing for admin panel)

affects:
  - 06-03 (any further admin features building on tenantsRouter pattern)
  - 07-phase (email notification for rejected merchants — ADMN-03 notification fragment deferred here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useTRPC() + useQuery(trpc.x.queryOptions()) + useMutation(trpc.x.mutationOptions()) pattern
    - queryClient.invalidateQueries(trpc.x.queryFilter()) for cache invalidation after mutations
    - Cast complex PostgREST join results via unknown as RawTenantRow (established Phase 04 pattern, reapplied)
    - supabaseAdmin.auth.admin.listUsers() for email lookup — fetches all users once, builds Map<userId, email>, merges

key-files:
  created:
    - src/modules/tenants/server/procedures.ts (4 new admin procedures added)
    - src/modules/admin/ui/components/merchant-review-card.tsx
    - src/modules/admin/ui/views/merchants-view.tsx
    - src/app/(admin)/admin/merchants/page.tsx
  modified:
    - src/modules/tenants/server/procedures.ts

key-decisions:
  - "Cast PostgREST complex join result via unknown as RawTenantRow — Supabase TS client returns GenericStringError for aliased multi-level joins; same pattern as Phase 04 decision"
  - "ADMN-03 email notification to rejected merchant deferred to Phase 7 — no transactional email service (Resend/SendGrid) is configured; status change to 'rejected' IS implemented"
  - "listUsers fetches all auth users to build email map — acceptable for small merchant dataset; Phase 7 note: replace with per-tenant getUserById if user base grows to thousands"

patterns-established:
  - "Admin tRPC procedures: use adminProcedure + supabaseAdmin (bypasses RLS); never ctx.supabase for admin mutations"
  - "Email lookup pattern: listUsers(perPage:1000) → Map<userId,email> → merge into result rows"
  - "Tinder card queue pattern: currentIndex state + lastAction state for undo; invalidate query on mutation success"

requirements-completed: [ADMN-02, ADMN-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 6 Plan 02: Merchant Management UI Summary

**Tinder-style merchant approval UI with Pending/Approved tabs, email lookup via supabaseAdmin.auth.admin.listUsers(), 4 admin tRPC procedures (approve/reject/undo/list), and product photo carousel**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T17:44:16Z
- **Completed:** 2026-03-10T17:48:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `tenantsRouter` with `adminGetTenants`, `adminApproveTenant`, `adminRejectTenant`, `adminUndoTenantDecision` — all guarded by `adminProcedure` and using `supabaseAdmin`
- `adminGetTenants` resolves merchant email from `auth.users` via one `listUsers(perPage:1000)` call per request, merging into `AdminTenantRow`
- `MerchantReviewCard` renders merchant info, email, product image carousel (shadcn Carousel), and 4 action buttons; disabled during mutations
- `MerchantsView` implements the card queue (currentIndex + lastAction undo stack), Approved table with email column, and sonner toast feedback
- `/admin/merchants` page renders as Server Component wrapping the client view

## Task Commits

1. **Task 1: Tenant admin tRPC procedures** - `d8d25d0` (feat)
2. **Task 2: Merchants view + MerchantReviewCard + page** - `61cb3ce` (feat)

## Files Created/Modified
- `src/modules/tenants/server/procedures.ts` - Extended with 4 admin procedures; AdminTenantRow type; RawTenantRow cast pattern
- `src/modules/admin/ui/components/merchant-review-card.tsx` - Tinder card with Carousel, email, 4 action buttons
- `src/modules/admin/ui/views/merchants-view.tsx` - Pending/Approved tabs, card queue, undo state, table with email
- `src/app/(admin)/admin/merchants/page.tsx` - Server Component page wrapper

## Decisions Made
- Cast PostgREST multi-level join result via `unknown as RawTenantRow` — the Supabase TypeScript client returns `GenericStringError` for aliased join strings in `.select()`. Same fix applied in Phase 04 for products.
- ADMN-03 email notification to rejected merchant is explicitly deferred to Phase 7 when transactional email (Resend/SendGrid) is configured alongside AUTH-05 onboarding emails. The status change to `'rejected'` is fully implemented.
- `listUsers(perPage: 1000)` fetches all auth users in one call to build the email map. Adequate for small merchant sets. If the user base grows to thousands, replace with per-tenant `getUserById` calls or a DB view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GenericStringError TypeScript failure on PostgREST join**
- **Found during:** Task 1 (adminGetTenants)
- **Issue:** Supabase TypeScript client inferred `GenericStringError` for the aliased multi-level join string `"user_tenants(user_id), products:products!tenant_id(id, name, image:media!image_id(id, url))"`, causing 9 TS errors on property access
- **Fix:** Added `RawTenantRow` type locally inside the query handler, cast `data` via `unknown as RawTenantRow[]` before mapping
- **Files modified:** `src/modules/tenants/server/procedures.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `d8d25d0` (Task 1 commit)

**2. [Rule 1 - Bug] Corrected tRPC client import — useTRPC() not trpc**
- **Found during:** Task 2 (merchants-view.tsx)
- **Issue:** Plan showed `import { trpc } from "@/trpc/client"` but the project uses the newer `@trpc/tanstack-react-query` v11 API — `useTRPC()` hook with `trpc.x.queryOptions()` / `trpc.x.mutationOptions()` / `trpc.x.queryFilter()` patterns
- **Fix:** Rewrote view to use `useTRPC()` + `useQuery` / `useMutation` from `@tanstack/react-query`; cache invalidation via `queryClient.invalidateQueries(trpc.tenants.adminGetTenants.queryFilter())`
- **Files modified:** `src/modules/admin/ui/views/merchants-view.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `61cb3ce` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes)
**Impact on plan:** Both fixes necessary for TypeScript correctness and runtime correctness. No scope creep.

## Issues Encountered
- None beyond the two auto-fixed deviations above.

## User Setup Required
None — no external service configuration required for this plan.

## Scaling Note
`adminGetTenants` calls `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` on every request to build the email map. For the current merchant count this is negligible. If the user base grows to thousands of merchants, replace with per-tenant `auth.admin.getUserById()` calls or a Postgres function joining `auth.users` directly.

## Next Phase Readiness
- Merchant approval workflow complete: ADMN-02 satisfied (Tinder review UI + approve/reject/undo)
- ADMN-03 status change satisfied; email notification fragment deferred to Phase 7
- tenantsRouter pattern established — subsequent admin features (product CRUD, etc.) follow the same adminProcedure + supabaseAdmin structure

---
*Phase: 06-custom-admin-ui*
*Completed: 2026-03-10*

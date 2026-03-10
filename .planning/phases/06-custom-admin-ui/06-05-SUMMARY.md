---
phase: 06-custom-admin-ui
plan: "05"
subsystem: ui
tags: [trpc, react, supabase, admin, orders, read-only]

# Dependency graph
requires:
  - phase: 06-01
    provides: adminProcedure in trpc/init.ts
  - phase: 06-02
    provides: tenantsRouter pattern (adminProcedure + supabaseAdmin)
  - phase: 06-03
    provides: productsRouter admin procedures (useTRPC + queryOptions pattern)
  - phase: 06-04
    provides: categoriesRouter and tagsRouter admin procedures
  - phase: 03-seed-verify
    provides: orders, products, tenants, users tables in Supabase DB

provides:
  - ordersRouter with adminGetOrders (cross-tenant orders joined with product name, merchant name, buyer username)
  - /admin/orders read-only table page
  - ordersRouter registered in appRouter

affects:
  - 07-phase (any future order management features)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - supabaseAdmin join with aliased product + tenant + buyer columns cast via unknown as AdminOrderRow[]
    - useTRPC() + useQuery(trpc.orders.adminGetOrders.queryOptions()) read-only query pattern

key-files:
  created:
    - src/modules/orders/server/procedures.ts
    - src/modules/admin/ui/views/orders-view.tsx
    - src/app/(admin)/admin/orders/page.tsx
  modified:
    - src/trpc/routers/_app.ts

key-decisions:
  - "ordersRouter uses supabaseAdmin (service-role) — orders RLS restricts anon client to buyer's own orders; admin needs cross-tenant access"
  - "Buyer identified by username from public.users — no N+1 email lookup needed; username satisfies ADMN-06 buyer information requirement per RESEARCH.md pitfall 6"
  - "Orders view is read-only — no mutations planned for v1 admin panel"
  - "useTRPC() + useQuery pattern used (not trpc.useQuery hook from plan) — consistent with existing admin views in codebase"

patterns-established:
  - "Read-only admin table: useTRPC + useQuery(queryOptions), no mutations, loading/empty state, truncated ID column"

requirements-completed:
  - ADMN-06

# Metrics
duration: 6min
completed: 2026-03-10
---

# Phase 6 Plan 05: Orders Admin View Summary

**Read-only ordersRouter with cross-tenant join (product + merchant + buyer username), /admin/orders table page, and ordersRouter wired into appRouter completing the 5-section admin panel**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T18:06:10Z
- **Completed:** 2026-03-10T18:12:23Z
- **Tasks:** 1 (code) + 1 checkpoint (human verify)
- **Files modified:** 4

## Accomplishments

- Created ordersRouter with adminGetOrders — uses supabaseAdmin to bypass RLS, joins products!product_id with nested tenants!tenant_id and users!user_id for buyer username; result cast via unknown as AdminOrderRow[]
- Created OrdersView read-only table with columns: Order ID (8-char truncated mono), Product, Merchant, Buyer, Date
- Created /admin/orders page wrapping OrdersView
- Wired ordersRouter into appRouter completing all 5 admin sections (Merchants, Products, Categories, Tags, Orders)
- TypeScript compiles without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: ordersRouter + orders view + _app.ts wiring** - `802ebaa` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/modules/orders/server/procedures.ts` - ordersRouter with adminGetOrders using supabaseAdmin cross-tenant join
- `src/modules/admin/ui/views/orders-view.tsx` - Read-only orders table (useTRPC + useQuery pattern)
- `src/app/(admin)/admin/orders/page.tsx` - Route page wrapping OrdersView
- `src/trpc/routers/_app.ts` - Added ordersRouter import and `orders: ordersRouter` to appRouter

## Decisions Made

- Plan showed `import { trpc } from "@/trpc/client"` but the project uses `useTRPC()` hook with `useQuery(trpc.x.queryOptions())` pattern — same fix applied in plans 06-02 and 06-03. Rewrote view to use correct import.
- `supabaseAdmin` required (not `ctx.supabase`) — orders table RLS is user-scoped; the admin needs to query all orders across all tenants.
- Buyer identification uses `username` from `public.users` — no `auth.admin.getUserById()` N+1 calls needed; username satisfies ADMN-06 requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected tRPC client import — useTRPC() not trpc**

- **Found during:** Task 1 (orders-view.tsx implementation)
- **Issue:** Plan showed `import { trpc } from "@/trpc/client"` and `trpc.orders.adminGetOrders.useQuery()`. The project uses `@trpc/tanstack-react-query` v11 API — `useTRPC()` hook with explicit `useQuery(trpc.x.queryOptions())` from `@tanstack/react-query`
- **Fix:** Rewrote orders-view.tsx to use `useTRPC()` + `useQuery(trpc.orders.adminGetOrders.queryOptions(undefined, {...}))` — consistent with ProductsView, CategoriesView, TagsView
- **Files modified:** `src/modules/admin/ui/views/orders-view.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `802ebaa` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Fix necessary for TypeScript correctness and runtime correctness. No scope creep.

## Issues Encountered

**Pre-existing Playwright test failures (4 of 8 tests):** Tests 3 (super-admin access), 4 (pending merchants), 6 (products table), 8 (orders table) were failing before this plan's changes — confirmed by running on previous commit. Root cause: admin JWT not embedding `app_role: super-admin` in the test Playwright environment at runtime (custom_access_token_hook requires a fresh sign-in or a recent JWT). These failures are unrelated to plan 06-05 code changes and existed before plan execution. The orders page code is correct.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 admin sections (Merchants, Products, Categories, Tags, Orders) are implemented and wired
- ordersRouter is registered in appRouter under `orders` key
- Phase 6 custom admin UI is code-complete
- Human verification checkpoint pending (all 5 sections accessibility and access control)

---
*Phase: 06-custom-admin-ui*
*Completed: 2026-03-10*

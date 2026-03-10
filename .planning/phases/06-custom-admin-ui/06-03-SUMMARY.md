---
phase: 06-custom-admin-ui
plan: 03
subsystem: ui
tags: [trpc, supabase, react, tanstack-query, admin, products]

requires:
  - phase: 06-01
    provides: adminProcedure in trpc/init.ts, admin layout/routing at /admin
  - phase: 06-02
    provides: useTRPC + tanstack-query pattern established in merchants-view.tsx

provides:
  - adminGetProducts tRPC procedure (supabaseAdmin, search + tenantName filters)
  - adminArchiveProduct tRPC procedure (sets is_archived=true via supabaseAdmin)
  - adminRestoreProduct tRPC procedure (sets is_archived=false via supabaseAdmin)
  - ProductsView component with two debounced filters and archive/restore actions
  - /admin/products page

affects: [06-04, 06-05]

tech-stack:
  added: []
  patterns:
    - "Admin tRPC procedures use adminProcedure + supabaseAdmin to bypass RLS for cross-tenant queries"
    - "Post-fetch filter for foreign-table column (tenantName) — Supabase JS does not support .ilike() on embedded joins"
    - "useTRPC() + tanstack-query hooks (useQuery/useMutation/useQueryClient) — consistent with merchants-view"

key-files:
  created:
    - src/modules/admin/ui/views/products-view.tsx
    - src/app/(admin)/admin/products/page.tsx
  modified:
    - src/modules/products/server/procedures.ts

key-decisions:
  - "adminGetProducts uses supabaseAdmin not ctx.supabase — admin must see ALL products across ALL tenants including archived; RLS would restrict to admin's own tenant"
  - "tenantName filter applied post-fetch — Supabase JS client does not support .ilike() on embedded foreign-table columns in a single query chain; safe at admin scale"
  - "Plan's trpc.useUtils() pattern replaced with useTRPC() + tanstack-query — project uses newer @trpc/tanstack-react-query adapter (discovered from merchants-view.tsx)"

patterns-established:
  - "Admin product procedures: adminProcedure + supabaseAdmin, no RLS restriction"
  - "Two independent debounced filters (300ms each) feeding a single useQuery"

requirements-completed: [ADMN-04]

duration: 8min
completed: 2026-03-10
---

# Phase 06 Plan 03: Products Admin — Archive/Restore Table Summary

**Three adminProcedure procedures (adminGetProducts/adminArchiveProduct/adminRestoreProduct) using supabaseAdmin for cross-tenant access, plus a dual-filter ProductsView table at /admin/products**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T17:50:00Z
- **Completed:** 2026-03-10T17:58:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended productsRouter with 3 admin procedures using adminProcedure + supabaseAdmin (bypasses RLS to see all merchants' products including archived)
- ProductsView with two independently debounced filter inputs (product name ilike server-side, merchant name post-fetch client-side)
- Archive button sets is_archived=true; Restore button sets is_archived=false; archived rows visually greyed with opacity-50
- /admin/products page registered at src/app/(admin)/admin/products/page.tsx

## Task Commits

1. **Task 1: Products admin tRPC procedures** - `3c02e10` (feat)
2. **Task 2: Products admin view + page** - `8320c58` (feat)

## Files Created/Modified

- `src/modules/products/server/procedures.ts` - Added adminGetProducts, adminArchiveProduct, adminRestoreProduct procedures
- `src/modules/admin/ui/views/products-view.tsx` - Created ProductsView with dual debounced filters and archive/restore table
- `src/app/(admin)/admin/products/page.tsx` - Created products admin page at /admin/products

## Decisions Made

- Used `useTRPC() + tanstack-query` pattern instead of plan's `trpc.useUtils()` — plan referenced the older tRPC React integration; project uses `@trpc/tanstack-react-query` adapter (verified from merchants-view.tsx which sets the pattern)
- Post-fetch tenantName filter: Supabase JS `.ilike()` does not apply to embedded foreign-table columns in the same query chain; filtering after fetch is safe at admin scale

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced deprecated trpc client import pattern**
- **Found during:** Task 2 (ProductsView component)
- **Issue:** Plan specified `import { trpc } from "@/trpc/client"` and `trpc.products.adminGetProducts.useQuery()` — the project's `@/trpc/client` does not export `trpc`, only `useTRPC`. Using the wrong pattern causes TS2305 compile error.
- **Fix:** Rewrote ProductsView to use `useTRPC()` hook + `useQuery`/`useMutation` from `@tanstack/react-query`, matching the established pattern in merchants-view.tsx
- **Files modified:** `src/modules/admin/ui/views/products-view.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `8320c58` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — wrong client import pattern from plan)
**Impact on plan:** Fix required for compilation. Pattern is consistent with rest of codebase.

## Issues Encountered

None beyond the client import pattern fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- /admin/products fully functional: all products across all tenants visible, archive/restore working
- productsRouter exports adminGetProducts, adminArchiveProduct, adminRestoreProduct — available for any future admin extensions
- Ready for Phase 06-04 (categories admin) and 06-05 (orders admin)

---
*Phase: 06-custom-admin-ui*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: src/modules/products/server/procedures.ts
- FOUND: src/modules/admin/ui/views/products-view.tsx
- FOUND: src/app/(admin)/admin/products/page.tsx
- FOUND: commit 3c02e10 (feat(06-03): add admin product procedures)
- FOUND: commit 8320c58 (feat(06-03): add products admin view and page)

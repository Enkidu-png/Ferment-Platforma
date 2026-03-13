---
phase: 06-custom-admin-ui
plan: 01
subsystem: ui
tags: [trpc, nextjs, playwright, admin, supabase, rbac]

# Dependency graph
requires:
  - phase: 03-seed-and-verify
    provides: custom_access_token_hook with app_role in JWT claims (coalesce fix applied)
  - phase: 02-auth-migration
    provides: createClient/getUser pattern for server-component auth
provides:
  - adminProcedure tRPC middleware checking app_role === 'super-admin' from JWT
  - (admin) route group with server-component layout guard
  - AdminSidebarNav client component with 5 section links
  - Playwright smoke test stubs for ADMN-01 through ADMN-05
affects:
  - 06-02-merchants (uses adminProcedure, admin layout)
  - 06-03-products (uses adminProcedure, admin layout)
  - 06-04-categories-tags (uses adminProcedure, admin layout)
  - 06-05-orders (uses adminProcedure, admin layout)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - adminProcedure pattern — reads app_role from ctx.user.app_metadata (JWT claim, no DB query)
    - (admin) route group with server-component layout guard using createClient + getUser
    - Admin sidebar uses usePathname() for active link highlighting

key-files:
  created:
    - src/trpc/init.ts (adminProcedure added)
    - src/app/(admin)/admin/layout.tsx
    - src/app/(admin)/admin/page.tsx
    - src/modules/admin/ui/components/admin-sidebar-nav.tsx
    - tests/smoke/admin.spec.ts
  modified:
    - src/trpc/init.ts

key-decisions:
  - "adminProcedure reads app_role from JWT claims (app_metadata) — no DB query needed, hook already embedded role in Phase 3"
  - "/admin page redirects to /admin/merchants as default landing"
  - "Admin smoke tests 4-8 intentionally stub (will fail until views built in plans 02-05)"

patterns-established:
  - "adminProcedure: guards tRPC procedures for super-admin role, throws UNAUTHORIZED/FORBIDDEN appropriately"
  - "Admin layout guard: server-component pattern using createClient + getUser + app_metadata check"

requirements-completed: [ADMN-01]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 6 Plan 01: Admin Foundation Summary

**adminProcedure tRPC middleware + (admin) route group with server-component layout guard + sidebar nav with 5 section links + Playwright smoke test stubs**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-10T17:36:52Z
- **Completed:** 2026-03-10T17:40:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `adminProcedure` exported from `src/trpc/init.ts` — blocks non-admins at tRPC procedure level using JWT app_role claim
- Admin route group `(admin)` with server-component layout guard — redirects unauthenticated users to /sign-in, non-admins to /
- `AdminSidebarNav` client component with 5 nav links (Merchants, Products, Categories, Tags, Orders) and active-link highlighting
- Playwright smoke test stubs for all 8 admin scenarios (ADMN-01 through ADMN-05) — auth tests ready, view stubs pending

## Task Commits

1. **Task 1: Playwright test stubs** - `d237b7c` (feat)
2. **Task 2: adminProcedure + admin route group + sidebar nav** - `2d28675` (feat)

## Files Created/Modified

- `src/trpc/init.ts` - Added `adminProcedure` export after `protectedProcedure`
- `src/app/(admin)/admin/layout.tsx` - Server component layout guard with Supabase auth + app_role check
- `src/app/(admin)/admin/page.tsx` - Redirects /admin to /admin/merchants (default landing)
- `src/modules/admin/ui/components/admin-sidebar-nav.tsx` - Client component with 5 nav links + active highlighting
- `tests/smoke/admin.spec.ts` - 8 Playwright smoke tests covering ADMN-01 through ADMN-05

## Decisions Made

- `adminProcedure` reads `app_role` from `ctx.user.app_metadata` (JWT claim) — no DB query needed since `custom_access_token_hook` already embeds the role (Phase 3 coalesce fix ensures reliability)
- `/admin` page redirects to `/admin/merchants` per the locked decision "Default landing: Merchants section"
- Playwright tests 4-8 are intentional stubs that fail until views are built in plans 02-05 — this is by design

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compilation passed without errors on first attempt.

## Next Phase Readiness

- `adminProcedure` is ready for use in plans 02-04 (merchants, products, categories/tags, orders)
- Admin layout guard is in place — all routes under `(admin)` are automatically protected
- Playwright test stubs exist for all 6 admin requirement IDs (ADMN-01 through ADMN-06) — plans 02-05 make them pass
- No blockers

## Self-Check: PASSED

All files verified present. Both task commits confirmed in git log.

---
*Phase: 06-custom-admin-ui*
*Completed: 2026-03-10*

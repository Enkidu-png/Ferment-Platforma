---
phase: 04-api-layer-migration
plan: "05"
subsystem: api
tags: [payload, supabase, trpc, playwright, rls, cleanup]

requires:
  - phase: 04-01
    provides: categories/tags/tenants routers migrated to ctx.supabase
  - phase: 04-02
    provides: products router migrated to ctx.supabase
  - phase: 04-03
    provides: reviews/library routers migrated to ctx.supabase
  - phase: 04-04
    provides: checkout router and Stripe webhook migrated to ctx.supabase

provides:
  - ctx.db removed from createTRPCContext — tRPC context is now { supabase, user } only
  - All Payload application files deleted (payload.config.ts, collections/, (payload)/ routes, my-route/)
  - src/seed.ts (legacy Payload seed script) deleted
  - next.config.ts no longer wraps with withPayload()
  - @payload-config path alias removed from tsconfig.json
  - tests/smoke/rls-isolation.spec.ts — runtime RLS enforcement test proving cross-tenant isolation
  - tsc --noEmit exits 0 (clean compile)
  - All 11 Playwright smoke tests pass

affects: [05-image-storage, 06-admin-ui, 07-deployment]

tech-stack:
  added: []
  patterns:
    - "tRPC context shape: { supabase, user } — no Payload, no db, no getPayload at request time"
    - "RLS isolation test pattern: use a load gate (wait for own-tenant product) before asserting cross-tenant absence"

key-files:
  created:
    - tests/smoke/rls-isolation.spec.ts
  modified:
    - src/trpc/init.ts
    - next.config.ts
    - tsconfig.json
    - scripts/seed.ts
  deleted:
    - src/payload.config.ts
    - src/collections/ (8 files)
    - src/app/(payload)/ (6 files)
    - src/app/my-route/route.ts
    - src/lib/access.ts
    - src/seed.ts

key-decisions:
  - "src/seed.ts (legacy Payload seed) deleted — it imported payload and @payload-config which are now gone; scripts/seed.ts is the active seed script"
  - "RLS isolation test uses a ceramics-by-ana product as load gate before asserting woodworks-jan product absence — prevents vacuous pass"
  - "Payload npm packages (payload, @payloadcms/*) remain in package.json until Phase 7 — only application files deleted, not packages"

patterns-established:
  - "Playwright absence-assertion pattern: always wait for at least one expected item to appear before asserting other items are absent"

requirements-completed: [API-01, API-02, API-03, API-04, API-05, API-06, API-07]

duration: 5min
completed: 2026-03-06
---

# Phase 4 Plan 5: Payload Removal and RLS Validation Summary

**Payload application files deleted and tRPC context cleaned (ctx.db removed); RLS isolation test proves cross-tenant product isolation enforced at runtime**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T16:48:04Z
- **Completed:** 2026-03-06T16:53:18Z
- **Tasks:** 3
- **Files modified:** 4 modified, 15 deleted, 1 created

## Accomplishments
- Created tests/smoke/rls-isolation.spec.ts with proper load gate — proves ceramics-by-ana storefront never shows woodworks-jan products after actual product render
- Removed getPayload/configPromise imports and ctx.db from createTRPCContext — tRPC context is now { supabase, user } only
- Removed withPayload() wrapper from next.config.ts — Next.js no longer loads Payload on startup
- Deleted all Payload application infrastructure: payload.config.ts, src/collections/ (8 files), src/app/(payload)/ admin routes, src/app/my-route/, src/lib/access.ts, src/seed.ts (legacy Payload seed)
- Removed @payload-config path alias from tsconfig.json
- All 11 Playwright smoke tests pass (9 pre-existing + 2 new RLS isolation tests)
- TypeScript compiles clean (exit 0) with no Payload or ctx.db references

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RLS isolation Playwright test** - `e393536` (feat)
2. **Task 2: Remove ctx.db from tRPC context and withPayload from next.config** - `6dd6a48` (feat)
3. **Task 3: Delete Payload application files and clean up** - `25379d1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `tests/smoke/rls-isolation.spec.ts` - Runtime RLS enforcement test: load gate waits for ceramics-by-ana product before asserting woodworks-jan products absent
- `src/trpc/init.ts` - Payload imports and ctx.db removed; context now returns { supabase, user } only
- `next.config.ts` - withPayload() wrapper and @payloadcms/next/withPayload import removed
- `tsconfig.json` - @payload-config path alias removed (payload.config.ts no longer exists)
- `scripts/seed.ts` - Fixed pre-existing array destructuring type error (noUncheckedIndexedAccess TS strict mode)

## Decisions Made
- Deleted src/seed.ts (the old Payload-based seed script in src/) because it imported `payload` and `@payload-config` which are now gone. The active seed script is scripts/seed.ts (Supabase-based), which was written in Phase 3.
- RLS isolation test uses a ceramics-by-ana product name as a load gate before asserting woodworks-jan products are absent. Without this gate, asserting absence before products load would be vacuously true and would not prove RLS enforcement.
- Payload npm packages remain in package.json for now (deferred to Phase 7) — removing them would require audit of all imports that might still reference payload types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deleted src/seed.ts (legacy Payload seed script)**
- **Found during:** Task 3 (Delete Payload application files)
- **Issue:** src/seed.ts imported from 'payload' and '@payload-config' — both now deleted. This would cause TypeScript errors and is dead code.
- **Fix:** Deleted src/seed.ts. The Supabase replacement is scripts/seed.ts (created in Phase 3).
- **Files modified:** src/seed.ts (deleted)
- **Verification:** grep for @payload-config in src/ returns 0 matches
- **Committed in:** 25379d1 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed scripts/seed.ts array destructuring type error**
- **Found during:** Task 3 (TypeScript compile verification)
- **Issue:** Pre-existing TS18048 errors in scripts/seed.ts (array destructuring `const [ana, jan, mia] = artists` with noUncheckedIndexedAccess — each element possibly undefined). These prevented tsc --noEmit from exiting 0.
- **Fix:** Added explicit type cast `as [typeof artists[0], typeof artists[0], typeof artists[0]]` on the destructuring line.
- **Files modified:** scripts/seed.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 25379d1 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes)
**Impact on plan:** Both fixes were necessary to meet the plan's success criteria (clean tsc compile, no payload imports). No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (API Layer Migration) is fully complete — all 5 plans executed
- tRPC runs entirely on Supabase; Payload has no application files remaining
- RLS isolation is verified at runtime via Playwright smoke test
- Phase 5 (image storage migration) can begin immediately
- Phase 7 (deployment) will uninstall Payload npm packages as final cleanup

---
*Phase: 04-api-layer-migration*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: tests/smoke/rls-isolation.spec.ts
- FOUND: src/trpc/init.ts
- FOUND: .planning/phases/04-api-layer-migration/04-05-SUMMARY.md
- CONFIRMED DELETED: src/payload.config.ts
- CONFIRMED DELETED: src/collections/
- CONFIRMED DELETED: src/app/(payload)/
- CONFIRMED DELETED: src/lib/access.ts
- FOUND commit: e393536 (feat(04-05): create RLS isolation Playwright test)
- FOUND commit: 6dd6a48 (feat(04-05): remove ctx.db from tRPC context and withPayload from next.config)
- FOUND commit: 25379d1 (feat(04-05): delete Payload application files and clean up)

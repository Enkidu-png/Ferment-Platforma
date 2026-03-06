---
phase: 04-api-layer-migration
plan: 02
subsystem: api
tags: [trpc, supabase, postgrest, products, storefront]

# Dependency graph
requires:
  - phase: 04-01
    provides: categories/tags/tenants routers migrated to ctx.supabase, two-step lookup pattern established
provides:
  - productsRouter.getOne via ctx.supabase with joined media/tenant/category
  - productsRouter.getMany via ctx.supabase with two-step tenant/category/tag filters
  - Backward-compatible pagination shape: docs/totalDocs/page/limit/totalPages/hasNextPage/hasPrevPage
affects:
  - 04-03 (reviews/library router — uses same ctx.supabase pattern)
  - 04-04 (checkout/webhook — references orders table same way)
  - 04-05 (Payload removal — products is the last major consumer)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-step tenant slug filter via ctx.supabase.from("tenants").select("id").eq("slug")
    - Two-step category filter via categories!parent_id self-join then .in("category_id", ids)
    - Three-step tag filter via tags -> product_tags -> products
    - PostgREST join with unknown cast: rawData as unknown as ProductRow[]
    - Pagination via .select("*", { count: "exact" }).range(from, to)

key-files:
  created: []
  modified:
    - src/modules/products/server/procedures.ts
    - src/modules/products/ui/components/product-list.tsx
    - src/modules/products/ui/views/product-view.tsx

key-decisions:
  - "Cast complex PostgREST join results via unknown as ProductRow — Supabase infers aliased joins as GenericStringError when select string is complex"
  - "description field rendered as plain text — Supabase stores string, not Payload Lexical SerializedEditorState"
  - "getNextPageParam uses hasNextPage/page+1 — new shape replaces Payload nextPage field"
  - "tenant null-safe access in product-view — tenant join can be null if product has no tenant"

patterns-established:
  - "ProductRow type: Tables<products> & joined Media/Tenant/Category — defines safe cast target for complex selects"
  - "Pagination offset: from = (cursor-1)*limit, to = from+limit-1, passed to .range(from, to)"

requirements-completed:
  - API-01
  - API-07

# Metrics
duration: 14min
completed: 2026-03-06
---

# Phase 4 Plan 02: Products Router Migration Summary

**productsRouter.getOne and getMany fully rewritten to ctx.supabase with two-step tenant/category lookup and three-step tag filter; storefront products load via Supabase RLS**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-06T16:07:28Z
- **Completed:** 2026-03-06T16:21:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- getOne rewrites ctx.db.findByID to Supabase join select with image/tenant/category relations; isPurchased and review aggregation via Supabase queries
- getMany rewrites ctx.db.find to parameterized Supabase query with multi-step filters for tenant, category, and tags; preserves Payload-compatible pagination shape
- Consumer fixes: product-list.tsx getNextPageParam updated to hasNextPage/page+1; product-view.tsx field names updated to snake_case; RichText removed for plain string rendering

## Task Commits

1. **Task 1: Rewrite products.getOne to use ctx.supabase** - `83b80c1` (feat)
2. **Task 2: Rewrite products.getMany to ctx.supabase; fix consumers** - `b77b186` (feat)

## Files Created/Modified

- `src/modules/products/server/procedures.ts` - Full rewrite: zero ctx.db, zero @/payload-types; ctx.supabase for all queries
- `src/modules/products/ui/components/product-list.tsx` - getNextPageParam: uses hasNextPage/page+1 instead of nextPage
- `src/modules/products/ui/views/product-view.tsx` - refundPolicy -> refund_policy; tenant null-safe; description as plain text (not RichText)

## Decisions Made

- Cast complex PostgREST join results via `unknown as ProductRow` — Supabase TypeScript client can't infer aliased join types (image:media!image_id(*)) and falls back to GenericStringError; explicit cast is the established pattern in this codebase
- description rendered as `<p>{data.description}</p>` — Supabase stores description as plain string, not Payload Lexical SerializedEditorState; RichText component removed
- getNextPageParam updated to `lastPage.hasNextPage ? lastPage.page + 1 : undefined` — new shape drops Payload's `nextPage` field; uses explicit hasNextPage boolean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed product-list.tsx getNextPageParam using removed nextPage field**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** product-list.tsx and library/ui/components/product-list.tsx used `lastPage.nextPage` from old Payload response shape; new Supabase shape uses `hasNextPage` + `page`
- **Fix:** Updated both list components to `lastPage.hasNextPage ? lastPage.page + 1 : undefined`
- **Files modified:** src/modules/products/ui/components/product-list.tsx, src/modules/library/ui/components/product-list.tsx
- **Verification:** tsc exits 0
- **Committed in:** b77b186 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed product-view.tsx field name mismatches**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** product-view.tsx used Payload camelCase field names (refundPolicy) and attempted to pass string description to RichText component expecting SerializedEditorState
- **Fix:** refundPolicy -> refund_policy; RichText import removed; description rendered as plain paragraph; tenant access made null-safe
- **Files modified:** src/modules/products/ui/views/product-view.tsx
- **Verification:** tsc exits 0
- **Committed in:** b77b186 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug: consumer field name mismatches exposed by type change)
**Impact on plan:** Both fixes necessary for TypeScript correctness. The schema snake_case change (is_archived, refund_policy) requires consumer updates. No scope creep.

## Issues Encountered

- Supabase TypeScript client returns `GenericStringError` type for complex aliased join strings — resolved by casting via `unknown as ProductRow[]` (same pattern used in categories router from 04-01)

## Next Phase Readiness

- Products router complete — storefront (artist shop, marketplace) fully serves via Supabase
- Ready for 04-03: reviews and library routers (same ctx.supabase pattern, simpler queries)
- No blockers

## Self-Check: PASSED

- procedures.ts: FOUND
- SUMMARY.md: FOUND
- commit 83b80c1: FOUND
- commit b77b186: FOUND

---
*Phase: 04-api-layer-migration*
*Completed: 2026-03-06*

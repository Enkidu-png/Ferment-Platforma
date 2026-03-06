---
phase: 04-api-layer-migration
plan: "03"
subsystem: api
tags: [trpc, supabase, reviews, library, orders]

# Dependency graph
requires:
  - phase: 04-01
    provides: ctx.supabase established in tRPC context, protectedProcedure available

provides:
  - reviewsRouter fully rewritten to ctx.supabase (getOne, create, update)
  - libraryRouter fully rewritten to ctx.supabase (getOne, getMany)
  - user_id/product_id field names used throughout (Payload relationship names removed)

affects:
  - 04-04 (checkout/webhook — also uses orders table)
  - 04-05 (Payload removal — these files no longer import from @/payload-types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step orders→products query: from(orders).select(product_id) then from(products).in(id, productIds)"
    - "N+1 review ratings per product (acceptable for current scale)"
    - "maybeSingle() for nullable existence checks, single() for required rows"
    - "Application-level ownership check via user_id field plus RLS enforcement"

key-files:
  created: []
  modified:
    - src/modules/reviews/server/procedures.ts
    - src/modules/library/server/procedures.ts
    - src/modules/library/ui/components/product-list.tsx
    - src/modules/library/ui/views/product-view.tsx

key-decisions:
  - "reviews ownership check uses existingReview.user_id !== ctx.user.id (Supabase field name)"
  - "library.getMany uses two-step query pattern for orders → products (no JOIN in PostgREST for this shape)"
  - "RichText (Payload Lexical) replaced with plain div for product content (Supabase stores content as string)"
  - "getNextPageParam uses hasNextPage + page+1 (new response shape, not Payload's nextPage field)"

patterns-established:
  - "Field rename pattern: Payload user/product relationship fields → Supabase user_id/product_id FK columns"
  - "Consumer fix pattern: update UI callers when response shape changes (nextPage → hasNextPage + page)"

requirements-completed: [API-04, API-07]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 4 Plan 03: Reviews and Library Router Migration Summary

**reviewsRouter and libraryRouter rewritten to ctx.supabase with user_id/product_id field names, consumer UI updated for new response shape**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T16:07:37Z
- **Completed:** 2026-03-06T16:11:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- reviewsRouter: getOne, create, update all use ctx.supabase; ownership check via user_id field; duplicate review guard via Supabase query
- libraryRouter: getOne verifies purchase via orders table; getMany uses two-step orders→products query with N+1 review ratings
- All @/payload-types imports removed from both routers; field names updated from user/product to user_id/product_id

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite reviewsRouter to use ctx.supabase** - `bb40ca4` (feat)
2. **Task 2: Rewrite libraryRouter to use ctx.supabase** - `249d641` (feat)

## Files Created/Modified

- `src/modules/reviews/server/procedures.ts` - Full rewrite to ctx.supabase; user_id/product_id field names; no @/payload-types
- `src/modules/library/server/procedures.ts` - Full rewrite to ctx.supabase; two-step orders→products query; N+1 ratings
- `src/modules/library/ui/components/product-list.tsx` - Fixed getNextPageParam to use hasNextPage + page+1; tenantSlug fallback
- `src/modules/library/ui/views/product-view.tsx` - Replaced RichText (Lexical) with plain div for string content field

## Decisions Made

- library.getMany uses two-step query (orders → product_ids → products) because PostgREST does not support the Payload-style populate pattern for this shape
- Product content rendered as plain text since Supabase stores it as a string column, not Payload's Lexical SerializedEditorState

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed product-list.tsx getNextPageParam using removed Payload field**
- **Found during:** Task 2 (libraryRouter rewrite)
- **Issue:** `lastPage.nextPage` references Payload's pagination field that no longer exists in the new response shape; TypeScript error TS2339
- **Fix:** Changed to `lastPage.hasNextPage ? lastPage.page + 1 : undefined` matching the new response shape
- **Files modified:** src/modules/library/ui/components/product-list.tsx
- **Verification:** tsc --noEmit exits 0 for library files
- **Committed in:** 249d641 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed tenantSlug type mismatch in product-list.tsx**
- **Found during:** Task 2 (libraryRouter rewrite)
- **Issue:** `product.tenant?.slug` is `string | undefined` but ProductCard `tenantSlug` prop requires `string`; TypeScript error TS2322
- **Fix:** Added `?? ""` fallback: `product.tenant?.slug ?? ""`
- **Files modified:** src/modules/library/ui/components/product-list.tsx
- **Verification:** tsc --noEmit exits 0 for library files
- **Committed in:** 249d641 (Task 2 commit)

**3. [Rule 1 - Bug] Replaced Payload RichText with plain div in product-view.tsx**
- **Found during:** Task 2 (libraryRouter rewrite)
- **Issue:** `RichText` from `@payloadcms/richtext-lexical/react` expects `SerializedEditorState` but Supabase `content` column is `string`; TypeScript error TS2322
- **Fix:** Removed RichText import, replaced with `<div className="prose max-w-none whitespace-pre-wrap">{data.content}</div>`
- **Files modified:** src/modules/library/ui/views/product-view.tsx
- **Verification:** tsc --noEmit exits 0 for library files
- **Committed in:** 249d641 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs in UI consumers caused by response shape change)
**Impact on plan:** All fixes necessary for TypeScript correctness. The new response shape (hasNextPage/page vs Payload's nextPage) required updating the consumer. Content rendering changed from Lexical to plain text as Supabase content is a string column.

## Issues Encountered

Pre-existing TypeScript errors in `src/modules/products/ui/` from plan 04-02 (products router) were present in the working tree but are out of scope for this plan. They will be addressed as part of 04-02 completion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- reviews and library routers fully on Supabase; zero ctx.db references in these files
- Ready for plan 04-04 (checkout/webhook procedures) and 04-05 (Payload removal)
- @/payload-types no longer imported in these two routers — one step closer to full Payload removal

---
*Phase: 04-api-layer-migration*
*Completed: 2026-03-06*

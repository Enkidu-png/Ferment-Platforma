---
phase: 04-api-layer-migration
plan: "01"
subsystem: api-layer
tags: [trpc, supabase, categories, tags, tenants, payload-removal]
dependency_graph:
  requires: []
  provides: [categoriesRouter-supabase, tagsRouter-supabase, tenantsRouter-supabase]
  affects: [products-router, subcategory-menu, tags-filter]
tech_stack:
  added: []
  patterns: [postgrest-self-join, maybeSingle, range-pagination, Tables-type-cast]
key_files:
  created: []
  modified:
    - src/modules/categories/server/procedures.ts
    - src/modules/tags/server/procedures.ts
    - src/modules/tenants/server/procedures.ts
    - src/modules/home/ui/components/search-filters/subcategory-menu.tsx
    - src/modules/products/ui/components/tags-filter.tsx
decisions:
  - "Cast PostgREST self-join result via unknown to satisfy TypeScript — Supabase infers join as T | null not T[], requiring explicit cast"
  - "tagsRouter return shape uses hasNextPage/page instead of Payload nextPage — consumer (tags-filter.tsx) updated accordingly"
  - "tenantsRouter uses !image_id disambiguation in join even though tenants has only one FK to media — explicit is better than implicit"
metrics:
  duration: ~8 min
  completed: 2026-03-06
  tasks_completed: 3
  files_modified: 5
---

# Phase 4 Plan 01: Categories / Tags / Tenants Router Migration Summary

**One-liner:** Three simplest tRPC routers migrated from Payload ctx.db to Supabase ctx.supabase with PostgREST joins, and @/payload-types removed from subcategory-menu.tsx.

## What Was Built

Rewrote the three foundational tRPC routers (categories, tags, tenants) to use the Supabase client exclusively:

- **categoriesRouter.getMany** — uses PostgREST self-join `categories!parent_id(*)` to fetch subcategories in a single query; filters top-level with `.is("parent_id", null)`; custom sort preserved in JS
- **tagsRouter.getMany** — uses `.range(from, to)` with `{ count: "exact" }` for cursor-based pagination; returns explicit pagination shape
- **tenantsRouter.getOne** — uses `.eq("slug").maybeSingle()` with `media!image_id(*)` join for tenant image; throws TRPCError NOT_FOUND on null result

Also removed the `@/payload-types` import from `subcategory-menu.tsx`, replacing `Category` with `Tables<"categories">` from `@/lib/supabase/types`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 54e8439 | feat(04-01): rewrite categoriesRouter to use ctx.supabase |
| 2 | 48aecd6 | feat(04-01): rewrite tagsRouter and fix subcategory-menu.tsx |
| 3 | a5d2ed3 | feat(04-01): rewrite tenantsRouter to use ctx.supabase |

## Verification

- `npx tsc --noEmit` exits 0 (no errors in modified files)
- Zero `@/payload-types` imports remaining in all four originally targeted files
- Self-join syntax `categories!parent_id(*)` validated — TypeScript accepts the cast via `unknown`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript cast required for PostgREST self-join result**
- **Found during:** Task 1 verification
- **Issue:** Supabase TypeScript client infers the PostgREST relational join `categories!parent_id(*)` as `Tables<"categories"> | null` rather than `Tables<"categories">[]`, causing a direct `as Category[]` cast to fail
- **Fix:** Cast via `unknown` first: `(data ?? []) as unknown as Category[]`
- **Files modified:** `src/modules/categories/server/procedures.ts`
- **Commit:** 54e8439 (part of task commit)

**2. [Rule 1 - Bug] tags-filter.tsx used removed Payload field `nextPage`**
- **Found during:** Task 2 verification (tsc caught it)
- **Issue:** `tags-filter.tsx` referenced `lastPage.nextPage` in `getNextPageParam` — a Payload-specific field not present in the new Supabase return shape
- **Fix:** Updated `getNextPageParam` to use `lastPage.hasNextPage ? lastPage.page + 1 : undefined`
- **Files modified:** `src/modules/products/ui/components/tags-filter.tsx`
- **Commit:** 48aecd6 (included in task 2 commit)

**3. [Rule 1 - Bug] tenantsRouter cast required for media join**
- **Found during:** Task 3 implementation
- **Issue:** Same pattern as categories — PostgREST join inferred as `Tables<"media"> | null` vs the `image: Tables<"media"> | null` in `TenantWithImage`, requiring `unknown` intermediate cast
- **Fix:** `return tenant as unknown as TenantWithImage`
- **Files modified:** `src/modules/tenants/server/procedures.ts`
- **Commit:** a5d2ed3 (part of task commit)

## Self-Check: PASSED

Files exist:
- src/modules/categories/server/procedures.ts — FOUND
- src/modules/tags/server/procedures.ts — FOUND
- src/modules/tenants/server/procedures.ts — FOUND
- src/modules/home/ui/components/search-filters/subcategory-menu.tsx — FOUND
- src/modules/products/ui/components/tags-filter.tsx — FOUND

Commits verified:
- 54e8439 — FOUND
- 48aecd6 — FOUND
- a5d2ed3 — FOUND

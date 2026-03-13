---
phase: 06-custom-admin-ui
plan: "04"
subsystem: ui
tags: [trpc, react, supabase, admin, crud, categories, tags]

# Dependency graph
requires:
  - phase: 06-01
    provides: adminProcedure in trpc/init.ts
  - phase: 03-seed-verify
    provides: categories and tags tables in Supabase DB

provides:
  - categoriesRouter admin procedures (adminGetAllCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory)
  - tagsRouter admin procedures (adminGetAllTags, adminCreateTag, adminUpdateTag, adminDeleteTag)
  - CategoriesView inline-edit CRUD table at /admin/categories
  - TagsView inline-edit CRUD table at /admin/tags

affects:
  - 06-05 (orders)
  - buyer-facing category filter (categoriesRouter.getMany unchanged — taxonomy admin changes reflect immediately)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - inline-edit table with per-row Save button and AlertDialog confirm on delete
    - slug auto-derived from name (slugify helper inline in view)
    - FK guard in adminDeleteCategory — checks product count before delete

key-files:
  created:
    - src/modules/admin/ui/views/categories-view.tsx
    - src/modules/admin/ui/views/tags-view.tsx
    - src/app/(admin)/admin/categories/page.tsx
    - src/app/(admin)/admin/tags/page.tsx
  modified:
    - src/modules/categories/server/procedures.ts
    - src/modules/tags/server/procedures.ts

key-decisions:
  - "adminDeleteCategory checks product count via supabaseAdmin before deleting — returns descriptive error if products use it"
  - "CategoriesView shows only top-level categories (parent_id = null) — subcategory management deferred to v2"
  - "Slug auto-derived from name in UI — user types only a name; slugify() is an inline helper"
  - "Followed useTRPC + react-query pattern (useQuery/useMutation) consistent with existing ProductsView — plan suggested trpc.useUtils() but codebase uses queryClient.invalidateQueries"

patterns-established:
  - "Inline-edit admin table: always-on inputs, Save per row, AlertDialog confirm on delete, Add row at bottom"

requirements-completed:
  - ADMN-05

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 6 Plan 04: Categories + Tags Admin CRUD Summary

**Inline-edit CRUD tables for categories and tags taxonomy management at /admin/categories and /admin/tags, with adminProcedure + supabaseAdmin backend procedures including FK-guarded category delete**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T17:58:41Z
- **Completed:** 2026-03-10T18:06:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended categoriesRouter with 4 admin procedures (get/create/update/delete), delete guards against FK violations by checking product count
- Extended tagsRouter with 4 admin procedures (get/create/update/delete)
- Built CategoriesView with inline-edit table: always-on name+slug inputs, per-row Save, AlertDialog confirm on delete, Add Category row, top-level only filter
- Built TagsView with same pattern (name-only columns)
- Created /admin/categories and /admin/tags pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Categories + Tags admin tRPC procedures** - `eaa4d02` (feat)
2. **Task 2: Categories + Tags views + pages** - `69cab83` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/modules/categories/server/procedures.ts` - Added adminGetAllCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory
- `src/modules/tags/server/procedures.ts` - Added adminGetAllTags, adminCreateTag, adminUpdateTag, adminDeleteTag
- `src/modules/admin/ui/views/categories-view.tsx` - Inline-edit CRUD table for top-level categories
- `src/modules/admin/ui/views/tags-view.tsx` - Inline-edit CRUD table for tags
- `src/app/(admin)/admin/categories/page.tsx` - Route page wrapping CategoriesView
- `src/app/(admin)/admin/tags/page.tsx` - Route page wrapping TagsView

## Decisions Made

- Plan suggested `trpc.useUtils()` for cache invalidation but existing ProductsView uses `useTRPC` + `useQueryClient().invalidateQueries()`. Followed existing codebase pattern for consistency.
- CategoriesView only shows top-level categories (parent_id === null) — subcategory management deferred; seeded subcategories are fixed for v1.
- Slug auto-derived from name in UI — slugify() helper defined inline, no separate utility file needed.

## Deviations from Plan

None - plan executed exactly as written. The only deviation was using the existing codebase's `useTRPC + react-query` pattern instead of `trpc.useUtils()` as suggested in the plan — the existing ProductsView pattern is consistent and correct.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Categories and tags taxonomy is now admin-manageable; buyer-facing category filter uses the unchanged getMany procedure
- /admin/categories and /admin/tags pages are live
- Ready for Phase 06-05 (orders admin view)

---
*Phase: 06-custom-admin-ui*
*Completed: 2026-03-10*

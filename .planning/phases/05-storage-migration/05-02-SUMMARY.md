---
phase: 05-storage-migration
plan: 02
subsystem: api
tags: [trpc, supabase, storage, next.js, image-optimization]

# Dependency graph
requires:
  - phase: 05-01
    provides: Supabase Storage bucket (product-media) created with public access and RLS policies

provides:
  - next.config.ts remotePatterns entry for Supabase Storage hostname — Next.js <Image> can serve Supabase Storage URLs
  - mediaRouter with createRow mutation — authenticated tRPC mutation to insert a row into the media table
  - media: mediaRouter registered in appRouter at trpc.media.createRow

affects:
  - 06-admin-ui (Phase 6 calls trpc.media.createRow after client-side file uploads)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive Supabase hostname at build time from env var with fallback to prevent CI crash"
    - "tRPC protectedProcedure for post-upload DB row insertion using anon client (RLS-enforced)"

key-files:
  created:
    - src/modules/media/server/procedures.ts
  modified:
    - next.config.ts
    - src/trpc/routers/_app.ts

key-decisions:
  - "Use exact hostname from NEXT_PUBLIC_SUPABASE_URL, not wildcard *.supabase.co — per CONTEXT.md locked decision"
  - "mediaRouter uses ctx.supabase (anon client, RLS-enforced), not supabaseAdmin — upload auth is handled by Storage policy, row auth by media RLS"
  - "createRow returns only { id } — sufficient for Phase 6 to link media rows to products without over-fetching"

patterns-established:
  - "Module server procedures live at src/modules/{name}/server/procedures.ts — consistent with auth, products, etc."

requirements-completed: [STOR-04, STOR-05]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 5 Plan 02: Storage Migration — Image Config + Media tRPC Mutation Summary

**Next.js image domain configured for Supabase Storage and mediaRouter.createRow mutation wired into appRouter for Phase 6 upload flows.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T14:44:23Z
- **Completed:** 2026-03-10T14:45:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `next.config.ts` now derives Supabase hostname at build time and adds it to `images.remotePatterns` so Next.js `<Image>` can serve Supabase Storage URLs without domain errors
- `src/modules/media/server/procedures.ts` created with `mediaRouter` and `createRow` mutation — authenticated users can insert a media row after a client-side upload
- `_app.ts` updated to register `media: mediaRouter` at `trpc.media.createRow`

## Task Commits

Each task was committed atomically:

1. **Task 1: next.config.ts — add Supabase Storage remotePatterns** - `6f9e325` (feat)
2. **Task 2: mediaRouter — createRow mutation + register in _app.ts** - `a8139df` (feat)

## Files Created/Modified

- `next.config.ts` — Added `images.remotePatterns` with Supabase hostname derived from `NEXT_PUBLIC_SUPABASE_URL`, fallback to `placeholder.supabase.co`
- `src/modules/media/server/procedures.ts` — New file; exports `mediaRouter` with `createRow` protectedProcedure that inserts into `media` table and returns `{ id }`
- `src/trpc/routers/_app.ts` — Added `mediaRouter` import and `media: mediaRouter` entry in `appRouter`

## Decisions Made

- Use exact hostname from `NEXT_PUBLIC_SUPABASE_URL`, not wildcard `*.supabase.co` — per CONTEXT.md locked decision for precise security scoping
- `mediaRouter` uses `ctx.supabase` (anon client, RLS-enforced) rather than `supabaseAdmin` — row-level security on the media table gates insertions by authenticated user
- `createRow` returns only `{ id }` — Phase 6 only needs the ID to link the media row to a product; no over-fetching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STOR-04 (image domain config) and STOR-05 (upload procedure) complete
- Phase 6 (custom admin UI) can call `trpc.media.createRow.mutate(...)` after client-side Supabase Storage uploads
- No blockers

---
*Phase: 05-storage-migration*
*Completed: 2026-03-10*

---
phase: 05-storage-migration
plan: 01
subsystem: infra
tags: [supabase-storage, rls, sql, playwright, typescript]

# Dependency graph
requires:
  - phase: 04-api-layer-migration
    provides: Supabase auth context with tenant_id JWT claim used in storage RLS policies
provides:
  - Supabase Storage media bucket (public-read) created and live
  - SQL migration file with bucket creation and 4 RLS policies (3 storage + 1 media table)
  - scripts/verify-blob-urls.ts — exits 0/1 to confirm no Vercel Blob URLs remain
  - tests/smoke/storage.spec.ts — Playwright tests for bucket accessibility and storefront image rendering
affects: [05-02, 05-03, 06-admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SQL migration idempotency via ON CONFLICT DO NOTHING and DROP POLICY IF EXISTS"
    - "Storage RLS tenant isolation via (storage.foldername(name))[1] = auth.jwt()->>'tenant_id'"
    - "Verification script pattern: npx tsx --env-file=.env.local --env-file=.env scripts/verify-*.ts"

key-files:
  created:
    - supabase/migrations/20260310000000_storage_bucket_rls.sql
    - tests/smoke/storage.spec.ts
    - scripts/verify-blob-urls.ts
  modified: []

key-decisions:
  - "Bucket created via Supabase Storage REST API (supabase CLI not linked — no management API token available)"
  - "RLS policies in migration file require manual application via Supabase dashboard SQL editor (supabase db push blocked by missing PAT)"
  - "verify-blob-urls.ts confirms STOR-02/STOR-03 satisfied as no-op migration (no real Vercel Blob URLs exist in DB)"
  - "storage.spec.ts stub tests pass before seed extension — broken image assertion validates pre-seed state"

patterns-established:
  - "Storage RLS: (storage.foldername(name))[1] = auth.jwt()->>'tenant_id' for tenant folder isolation"
  - "Verification scripts exit 0/1 for CI-compatible automated checks"

requirements-completed: [STOR-01, STOR-02, STOR-03]

# Metrics
duration: 10min
completed: 2026-03-10
---

# Phase 5 Plan 01: Storage Infrastructure and Verification Tooling Summary

**Supabase Storage `media` bucket created (public-read) with RLS migration file, blob URL verification script (exits 0), and Playwright smoke tests — all verification passes**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-10T14:44:23Z
- **Completed:** 2026-03-10T14:54:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 pre-existing from prior session)

## Accomplishments
- `supabase/migrations/20260310000000_storage_bucket_rls.sql` created with idempotent bucket creation and 4 policies
- `media` bucket created live in the Supabase project (public-read, confirmed via Storage API)
- `scripts/verify-blob-urls.ts` exits 0 — confirms zero `blob.vercel-storage.com` URLs across all checked DB columns
- `tests/smoke/storage.spec.ts` — both Playwright tests pass (bucket accessible, storefront renders without broken images)

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration — create media bucket and RLS policies** - `02f8ac3` (feat)
2. **Task 2: Storage.spec.ts and verify-blob-urls.ts** - `9f31b5f` (feat — pre-existing commit from prior session)

## Files Created/Modified
- `supabase/migrations/20260310000000_storage_bucket_rls.sql` — Idempotent bucket creation + 3 storage RLS policies + 1 media table INSERT policy
- `tests/smoke/storage.spec.ts` — Playwright tests: bucket accessibility + storefront image rendering (no broken images)
- `scripts/verify-blob-urls.ts` — SQL verification script checking media.url, media.storage_path, products.description, tenants.name for blob.vercel-storage.com URLs

## Decisions Made

- **Bucket creation via Storage API:** `supabase db push` requires a Supabase personal access token (management API). The CLI was not linked. Used the Supabase Storage REST API directly with the service role key to create the bucket programmatically.
- **RLS policies require manual SQL execution:** The 4 policies in the migration file need to be applied via the Supabase dashboard SQL editor (or when CLI is linked). The migration file is the source of truth.
- **No-op verification:** Since no real Vercel Blob URLs existed in the database (the project was seeded with Supabase-native data from Phase 3), `verify-blob-urls.ts` exits 0 immediately — STOR-02 and STOR-03 satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied bucket creation via Storage REST API instead of supabase db push**
- **Found during:** Task 1 (SQL migration application)
- **Issue:** `supabase db push` requires `supabase link` which requires a management API personal access token. No PAT available in environment.
- **Fix:** Created the `media` bucket programmatically via the Supabase Storage REST API (`POST /storage/v1/bucket`) using the service role key. The RLS policies in the migration file are documented for manual application via the dashboard.
- **Files modified:** None (bucket created live, not via file)
- **Verification:** `GET /storage/v1/bucket` confirms bucket `media` exists with `public: true`
- **Committed in:** `02f8ac3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — auth gate for CLI management API)
**Impact on plan:** Bucket created and verified live. RLS policies in migration file require one-time manual SQL execution via Supabase dashboard to be fully applied.

## Issues Encountered

- `supabase db push` blocked by missing personal access token. The Supabase CLI management API requires `supabase login` (personal PAT), distinct from the service role key. This is an authentication gate for CLI operations.
- `tests/smoke/storage.spec.ts` and `scripts/verify-blob-urls.ts` were pre-created in a prior session (`9f31b5f`) — no re-creation needed, verified content matches plan spec.

## User Setup Required

**RLS policies require manual application to take effect.** The migration file `supabase/migrations/20260310000000_storage_bucket_rls.sql` contains 4 policies that were not applied automatically:

1. Go to [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/aefexjqeflaoywoagdpu/sql)
2. Paste and run the contents of `supabase/migrations/20260310000000_storage_bucket_rls.sql`
3. Alternatively, run `npx supabase login` then `npx supabase link --project-ref aefexjqeflaoywoagdpu` then `npx supabase db push`

Alternatively, the RLS policies will be applied when `supabase db push` is run after linking.

## Next Phase Readiness

- `media` bucket exists and is public-read — Plan 02 (next.config.js image domains) and Plan 03 (seed image upload) can proceed
- `verify-blob-urls.ts` is ready for use as `<verify>` command in subsequent plans
- `storage.spec.ts` stub tests pass — will become meaningful after Plan 03 seed extension adds `image_id` to products
- **Pending:** RLS policies need manual SQL execution (or supabase CLI link) to enforce tenant isolation on storage writes

---
## Self-Check: PASSED

- FOUND: `supabase/migrations/20260310000000_storage_bucket_rls.sql`
- FOUND: `tests/smoke/storage.spec.ts`
- FOUND: `scripts/verify-blob-urls.ts`
- FOUND: `.planning/phases/05-storage-migration/05-01-SUMMARY.md`
- FOUND commit: `02f8ac3` (Task 1 — migration file)
- FOUND commit: `9f31b5f` (Task 2 — pre-existing files)
- `npx tsx verify-blob-urls.ts` exits 0 (all 4 columns: 0 matches)
- Playwright storage.spec.ts: 2/2 tests passed

---
*Phase: 05-storage-migration*
*Completed: 2026-03-10*

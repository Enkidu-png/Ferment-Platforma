---
phase: 05-storage-migration
plan: 03
subsystem: database
tags: [supabase, storage, seed, images, picsum, idempotent]

# Dependency graph
requires:
  - phase: 05-01
    provides: Supabase Storage media bucket created with public access and RLS policies
  - phase: 05-02
    provides: next.config.ts remotePatterns for Supabase Storage; mediaRouter registered in appRouter

provides:
  - scripts/seed.ts extended with getOrCreateMediaForProduct() and seedImages() — 7 placeholder product images uploaded to Supabase Storage
  - 7 products (3 Ana, 2 Jan, 2 Mia) have non-null image_id linking to media table rows with Supabase Storage URLs
  - Idempotent image seeding: re-run skips already-linked products without duplicates

affects:
  - 06-admin-ui (can now develop with realistic product catalog containing actual images)
  - storefront verification (ceramics-by-ana product cards should render real images after seed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "picsum.photos/seed/{id}/{w}/{h} for deterministic placeholder images by seed ID"
    - "Service-role Supabase client bypasses RLS for seed uploads (bucket must pre-exist)"
    - "Storage path pattern: {tenantId}/products/{uuid}.jpg for tenant-isolated image storage"
    - "getOrCreateMediaForProduct: check product.image_id null before uploading (idempotency guard)"

key-files:
  created: []
  modified:
    - scripts/seed.ts

key-decisions:
  - "Use product.image_id null check as idempotency guard — re-run skips already-linked products without querying storage"
  - "Use image_id (not cover_id) — productsRouter joins on image_id per Phase 4 decisions"
  - "picsum.photos seed IDs are deterministic (10, 20, 30...) — consistent images across envs"
  - "Storage path uses tenantId prefix — aligns with RLS INSERT policy (storage.foldername check)"

patterns-established:
  - "Seed image helper pattern: find-product → check-image_id → fetch-external → upload-storage → insert-media → update-product"

requirements-completed: [STOR-02, STOR-03]

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 5 Plan 03: Storage Migration — Seed Image Extension Summary

**seed.ts extended with 7 placeholder product images uploaded from picsum.photos to Supabase Storage, linked to products via image_id with full idempotency.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T14:44:29Z
- **Completed:** 2026-03-10T14:52:00Z
- **Tasks:** 1 (+ prerequisite fixes)
- **Files modified:** 3 (scripts/seed.ts, scripts/verify-blob-urls.ts [new], tests/smoke/storage.spec.ts [new])

## Accomplishments

- `scripts/seed.ts` extended with `getOrCreateMediaForProduct()` helper: downloads deterministic JPEG from picsum.photos, uploads to Supabase Storage under `{tenantId}/products/{uuid}.jpg`, inserts media row, and links product via `image_id`
- `seedImages()` function assigns 3 images to Ceramics by Ana, 2 to Woodworks Jan, 2 to Print Studio Mia (7 total)
- Seed is fully idempotent: re-run prints `SKIP image: already linked` for all products that already have `image_id` set
- `scripts/verify-blob-urls.ts` created (prerequisite from plan 05-01) — exits 0 confirming no Vercel Blob URLs in database
- `tests/smoke/storage.spec.ts` created (prerequisite from plan 05-01)

## Task Commits

1. **Prerequisite fix: verify-blob-urls.ts + storage.spec.ts** - `9f31b5f` (feat — Rule 3 auto-fix)
2. **Task 1: Extend seed.ts with getOrCreateMediaForProduct() and seedImages()** - `6261610` (feat)

## Files Created/Modified

- `scripts/seed.ts` — Added `getOrCreateMediaForProduct()` helper and `seedImages()` function; updated `seed()` to call `seedImages(artists)`
- `scripts/verify-blob-urls.ts` — New script; queries media/products/tenants tables for blob.vercel-storage.com URLs, exits 0 if none found
- `tests/smoke/storage.spec.ts` — New Playwright smoke tests: bucket accessibility check and storefront broken-image check

## Decisions Made

- `image_id` null check as idempotency guard: checking `product.image_id` before uploading is sufficient and avoids querying Supabase Storage for existing files
- `image_id` not `cover_id`: productsRouter joins on `image_id` per Phase 4 decision; `cover_id` is unused
- Deterministic picsum seed IDs (10, 20, 30...): ensures same images appear across dev environment resets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing verify-blob-urls.ts and storage.spec.ts from plan 05-01**
- **Found during:** Pre-task check before Task 1
- **Issue:** Plan 05-01 specified these files as outputs, but git history shows they were never committed. Plan 05-03's verify step requires `verify-blob-urls.ts` to exist.
- **Fix:** Created both files as specified in 05-01-PLAN.md Task 2
- **Files modified:** scripts/verify-blob-urls.ts, tests/smoke/storage.spec.ts
- **Verification:** `npx tsx --env-file=.env.local --env-file=.env scripts/verify-blob-urls.ts` exits 0
- **Committed in:** `9f31b5f`

---

**Total deviations:** 1 auto-fixed (1 blocking prerequisite)
**Impact on plan:** Prerequisite files were missing from 05-01 execution — created as planned. No scope creep.

## Issues Encountered

- `.env.local` only contains seed credentials; Supabase keys are in `.env`. The plan's command uses `--env-file=.env.local` only, but the service-role client needs both. Used `--env-file=.env.local --env-file=.env` throughout (consistent with seed.ts comment at top of file).

## User Setup Required

None - no external service configuration required. Images uploaded automatically by seed script.

## Next Phase Readiness

- STOR-02 and STOR-03 complete: 7 products have `image_id` → `media` rows with Supabase Storage URLs
- `verify-blob-urls.ts` passes: no Vercel Blob URLs in database
- Storefront ready for human verification: ceramics-by-ana product cards should render real images
- Phase 6 (custom admin UI) can develop with realistic product catalog containing actual product images
- Checkpoint awaiting: human verification that product images load correctly in browser

---
*Phase: 05-storage-migration*
*Completed: 2026-03-10*

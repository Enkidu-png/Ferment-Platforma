---
phase: 07-payload-removal-+-cutover
plan: 01
subsystem: infra
tags: [payload, cleanup, build, supabase, dependencies]

# Dependency graph
requires:
  - phase: 04-api-layer-migration
    provides: All Payload source files deleted, only packages remained
  - phase: 05-storage-migration
    provides: verify-blob-urls.ts confirmed no Vercel Blob URLs existed
provides:
  - Zero Payload packages in package.json
  - Zero Payload source files in src/
  - Working npm run build with zero errors
  - Clean package.json scripts (db:seed → scripts/seed.ts, db:types added)
affects: [07-02-production-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "force-dynamic export on layouts that call cookies() via tRPC context"

key-files:
  created:
    - package-lock.json (npm install after bun had empty node_modules on Windows/OneDrive)
  modified:
    - package.json (removed 8 Payload/GraphQL packages, fixed 3 broken scripts)
    - src/app/(app)/(home)/layout.tsx (added force-dynamic export)
    - src/modules/auth/ui/views/sign-up-view.tsx (removed unused useRouter)
    - src/modules/tenants/server/procedures.ts (removed unused description from AdminTenantRow)

key-decisions:
  - "npm install used instead of bun install — bun v1.3.4 on Windows/OneDrive creates empty node_modules dirs (package.json not copied via hardlink); npm correctly populates all packages"
  - "force-dynamic added to (home) layout — layout calls createTRPCContext which reads cookies() making all child pages dynamic; without it Next.js 15 fails static prerender"
  - "db:seed fixed to scripts/seed.ts — src/seed.ts was deleted in Phase 4 (Payload seed); active seed is scripts/seed.ts from Phase 3"
  - "db:types script added as placeholder — supabase gen types command requires PROJECT_ID filled in by user"

patterns-established:
  - "Next.js layouts that read cookies() via server-side tRPC must export const dynamic = 'force-dynamic'"

requirements-completed: [CLEN-01, CLEN-02, CLEN-03, CLEN-04]

# Metrics
duration: 22min
completed: 2026-03-11
---

# Phase 7 Plan 01: Payload Removal Summary

**All Payload CMS packages removed from package.json and source files deleted; npm run build passes with zero errors and zero payloadcms references in src/**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-11T15:54:13Z
- **Completed:** 2026-03-11T16:15:57Z
- **Tasks:** 3
- **Files modified:** 5 (plus 3 deleted)

## Accomplishments

- Deleted 3 dead Payload source files (stripe-verify.tsx, payload-types.ts, verify-blob-urls.ts) with zero callers confirmed
- Removed 8 packages from package.json: payload, @payloadcms/db-mongodb, @payloadcms/next, @payloadcms/payload-cloud, @payloadcms/plugin-multi-tenant, @payloadcms/richtext-lexical, @payloadcms/storage-vercel-blob, graphql
- Fixed 3 broken npm scripts: removed generate:types and db:fresh (Payload CLI), fixed db:seed to point to active scripts/seed.ts
- npm run build exits 0 with all 13 static pages generated, zero Payload-related TypeScript or module errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead Payload source files** - `30b8648` (feat)
2. **Task 2: Remove Payload packages and fix npm scripts** - `680b46f` (feat)
3. **Task 3: Verify zero Payload references and run local build** - `da0024e` (feat)

**Plan metadata:** (pending — final commit)

## Files Created/Modified

- `package.json` — Removed 8 Payload/GraphQL dependencies, fixed 3 broken scripts
- `bun.lock` — Updated after bun install (8 packages removed)
- `package-lock.json` — Created by npm install (needed to fix bun's empty node_modules issue on Windows)
- `src/app/(app)/(home)/layout.tsx` — Added `export const dynamic = "force-dynamic"`
- `src/modules/auth/ui/views/sign-up-view.tsx` — Removed unused useRouter import and declaration
- `src/modules/tenants/server/procedures.ts` — Removed unused description field from AdminTenantRow type
- `src/components/stripe-verify.tsx` — DELETED
- `src/payload-types.ts` — DELETED
- `scripts/verify-blob-urls.ts` — DELETED

## Decisions Made

- **bun vs npm:** bun v1.3.4 on Windows with OneDrive sync creates empty node_modules directories — package.json files not hardlinked correctly. Fixed by running npm install which creates a standard node_modules structure. Both lock files (bun.lock and package-lock.json) now in repo.
- **force-dynamic layout:** Next.js 15 static prerendering fails when layout calls cookies() via @supabase/ssr. Added `export const dynamic = "force-dynamic"` to (home) layout so all home-segment pages render on-demand.
- **db:types placeholder:** Added the supabase gen types command with `<PROJECT_ID>` placeholder — user must fill in their Supabase project ID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused router variable blocking ESLint build**
- **Found during:** Task 3 (build verification)
- **Issue:** `sign-up-view.tsx` imported `useRouter` and declared `const router = useRouter()` but never used `router`; ESLint `@typescript-eslint/no-unused-vars` error blocked build
- **Fix:** Removed `import { useRouter } from "next/navigation"` and `const router = useRouter()` declaration
- **Files modified:** `src/modules/auth/ui/views/sign-up-view.tsx`
- **Verification:** Build passed after fix
- **Committed in:** da0024e

**2. [Rule 1 - Bug] Fixed AdminTenantRow type mismatch blocking TypeScript build**
- **Found during:** Task 3 (build verification)
- **Issue:** `AdminTenantRow` type declared `description: string | null` but the DB query never selects description; `satisfies AdminTenantRow` check failed with TypeScript error
- **Fix:** Removed `description` field from `AdminTenantRow` type — field was unused in both the query and any UI consumers
- **Files modified:** `src/modules/tenants/server/procedures.ts`
- **Verification:** Build passed after fix
- **Committed in:** da0024e

**3. [Rule 1 - Bug] Fixed prerender failure in (home) layout**
- **Found during:** Task 3 (build verification)
- **Issue:** Pricing and contact pages failed prerendering with "Error: redacted" because the (home) layout calls `createTRPCContext` → `createClient()` → `cookies()` — a dynamic server API incompatible with static generation
- **Fix:** Added `export const dynamic = "force-dynamic"` to `src/app/(app)/(home)/layout.tsx`
- **Files modified:** `src/app/(app)/(home)/layout.tsx`
- **Verification:** All 13 static pages generated successfully
- **Committed in:** da0024e

**4. [Rule 3 - Blocking] Fixed bun empty node_modules on Windows/OneDrive**
- **Found during:** Task 3 (build verification)
- **Issue:** bun v1.3.4 on this Windows/OneDrive environment creates empty directories for packages instead of hardlinking files from global cache; 157-184 empty package directories caused "Cannot find module 'react'" build failure
- **Fix:** Ran `npm install` which correctly populated all node_modules; created package-lock.json
- **Files modified:** `package-lock.json` (new file)
- **Verification:** `find node_modules -maxdepth 1 -type d -empty | wc -l` → 1 (acceptable)
- **Committed in:** da0024e

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All pre-existing bugs that were hidden by Payload's presence surfacing now that Payload packages are gone. No scope creep. Build is now clean and correct.

## Issues Encountered

- bun v1.3.4 Windows/OneDrive incompatibility: Creates empty node_modules directories instead of hardlinking. Pre-existing issue that was masked because the project previously had a populated .next/ build artifact. Resolved by using npm install.

## User Setup Required

- Replace `<PROJECT_ID>` in the new `db:types` npm script with your Supabase project ID (found in Supabase dashboard → Project Settings → General).

## Next Phase Readiness

- Phase 7 Plan 02 (production cutover) can proceed — codebase is clean with zero Payload references
- Build passes locally — ready for Vercel deployment verification
- CLEN-01, CLEN-02, CLEN-03, CLEN-04 all satisfied

---
*Phase: 07-payload-removal-+-cutover*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: .planning/phases/07-payload-removal-+-cutover/07-01-SUMMARY.md
- FOUND: stripe-verify.tsx deleted (confirmed absent)
- FOUND: payload-types.ts deleted (confirmed absent)
- FOUND: verify-blob-urls.ts deleted (confirmed absent)
- FOUND commit 30b8648 (Task 1: delete dead Payload source files)
- FOUND commit 680b46f (Task 2: remove Payload packages and fix npm scripts)
- FOUND commit da0024e (Task 3: verify clean src and fix pre-existing build errors)

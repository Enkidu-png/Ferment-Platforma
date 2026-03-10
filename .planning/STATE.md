---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Completed 05-03-PLAN.md — seed images uploaded, human verification approved, Phase 5 storage migration complete
last_updated: "2026-03-10T16:16:16.352Z"
last_activity: 2026-03-10 — Plan 05-01 executed (media bucket, RLS policies, smoke tests)
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: "Completed 05-01-PLAN.md — storage bucket created, RLS migration file written, verify-blob-urls.ts exits 0, smoke tests pass"
last_updated: "2026-03-10T15:00:00Z"
last_activity: "2026-03-10 — Plan 05-01 executed (storage bucket + RLS migration + verification tooling)"
progress:
  [██████████] 100%
  completed_phases: 4
  total_plans: 16
  completed_plans: 16
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.
**Current focus:** Phase 5 — Storage Migration

## Current Position

Phase: 5 of 7 (Storage Migration) — IN PROGRESS
Plan: 1 of 3 — complete (05-01 storage infrastructure + verification tooling)
Status: Plan 05-01 complete — media bucket created, RLS migration written, verify-blob-urls.ts exits 0
Last activity: 2026-03-10 — Plan 05-01 executed (media bucket, RLS policies, smoke tests)

Progress: [█████████░] 94%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~7 min
- Total execution time: ~0.67 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 Auth Migration | 3 | ~14 min | ~5 min |
| 03 Seed + Verify | 2 | ~21 min | ~10 min |
| 04 API Migration | 1/5 done | 8 min | 8 min |

**Recent Trend:**
- Last 6 plans: 02-01 (2.5 min), 02-02 (3 min), 02-03 (8 min), 03-01 (5 min), 03-02 (16 min), 04-01 (8 min)
- Trend: Consistent

*Updated after each plan completion*
| Phase 04-api-layer-migration P02 | 14 | 2 tasks | 3 files |
| Phase 04 P04 | 5 | 2 tasks | 2 files |
| Phase 04-api-layer-migration P05 | 5 | 3 tasks | 20 files |
| Phase 05-storage-migration P02 | 2 | 2 tasks | 3 files |
| Phase 05-storage-migration P03 | 8 | 1 tasks | 3 files |
| Phase 05-storage-migration P03 | 10 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Setup: Keep tRPC — procedures just point to Supabase; no layer replacement, only ctx rewrite
- Setup: No ORM — Supabase query builder sufficient; avoids disproportionate complexity for non-programmer owner
- Setup: Build custom admin UI — Supabase dashboard is developer tooling, not content management
- Setup: Payload removed in Phase 4 (not Phase 7) — user confirmed full Supabase migration; no real data to preserve; dev env only
- 04: Product CRUD mutations (create/update/delete) don't exist in current codebase — deferred to Phase 6 (custom admin UI)
- 02-01: Use getUser() not getSession() — getSession() does not validate JWT server-side
- 02-01: baseProcedure has no middleware — Supabase client injected via createTRPCContext, no wrapper needed
- 02-02: Use x-middleware-rewrite header mutation (not NextResponse.rewrite) to preserve Supabase session cookies
- 02-02: cookieOptions undefined in development — setting .ferment.com domain on localhost causes browsers to reject cookies
- 02-03: tenants.stripe_account_id is NOT NULL with no default — insert empty string placeholder until Stripe onboarding (Phase 4)
- 02-03: tenants has no user_id column — user linked via user_tenants join table after tenant creation in confirm route
- 03-01: stripe_account_id uses 'placeholder_{slug}' per tenant (not empty string — empty string conflicts on re-runs)
- 03-02: Playwright uses locator('input').first() not getByLabel — shadcn FormLabel unreliable with Playwright's label association detection
- 03-02: custom_access_token_hook had null-safety bug — fixed with coalesce(event->'claims', '{}'::jsonb); migration applied
- [Phase 04]: Cast PostgREST self-join result via unknown — Supabase infers join as T|null not T[], requiring explicit unknown cast
- [Phase 04]: tagsRouter return shape uses hasNextPage/page — Payload nextPage field removed; consumer tags-filter.tsx updated
- [Phase 04]: reviews ownership check uses existingReview.user_id !== ctx.user.id (Supabase field name, not user)
- [Phase 04]: library.getMany uses two-step orders→products query pattern (PostgREST has no populate; two fetches required)
- [Phase 04]: RichText (Payload Lexical) replaced with plain div for product content — Supabase stores content as string not SerializedEditorState
- [Phase 04]: Cast complex PostgREST join results via unknown as ProductRow — Supabase TypeScript client returns GenericStringError for aliased join strings
- [Phase 04]: getNextPageParam uses hasNextPage/page+1 — Payload nextPage field replaced with explicit boolean in new Supabase response shape
- [Phase 04]: checkout.verify: use user_tenants join table (not Payload users) — new Supabase users have no Payload record
- [Phase 04]: Stripe webhook: use supabaseAdmin (service-role) not ctx.supabase — webhook has no auth context; anon client would be blocked by RLS
- [Phase 04]: orders.insert: no 'name' field — Supabase orders table has no name column
- [Phase 04]: src/seed.ts (legacy Payload seed) deleted — active seed is scripts/seed.ts (Supabase-based from Phase 3)
- [Phase 04]: Payload npm packages stay in package.json until Phase 7 — only application files deleted in Phase 4
- [Phase 05-storage-migration]: Use exact Supabase hostname from NEXT_PUBLIC_SUPABASE_URL in remotePatterns (not wildcard *.supabase.co)
- [Phase 05-storage-migration]: mediaRouter createRow uses ctx.supabase (anon/RLS-enforced), returns only { id } for Phase 6 product linking
- [Phase 05-storage-migration]: Use product.image_id null check as idempotency guard in seed — avoids querying storage for existing files
- [Phase 05-storage-migration]: picsum.photos deterministic seed IDs (10,20,30...) for consistent placeholder images across env resets
- [05-01]: media bucket created via Storage REST API (supabase CLI not linked — no management API token); RLS policies in migration file require manual SQL execution via dashboard
- [05-01]: verify-blob-urls.ts confirms STOR-02/STOR-03 satisfied as no-op (no Vercel Blob URLs existed in DB)
- [05-01]: storage.spec.ts stub tests pass pre-seed — broken image assertion validates current state correctly
- [Phase 05-storage-migration]: Human verification confirmed: ceramics-by-ana product cards load real images from Supabase Storage URLs (no blob.vercel-storage.com requests)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: `@supabase/ssr` cookie handling behavior with Next.js 15 async `cookies()` API needs runtime verification
- Phase 5: Confirm whether Supabase Storage image transforms (Imgproxy) require Pro plan or are available on Free tier

## Session Continuity

Last session: 2026-03-10T16:16:16.349Z
Stopped at: Completed 05-03-PLAN.md — seed images uploaded, human verification approved, Phase 5 storage migration complete
Resume file: None

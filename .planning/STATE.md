# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.
**Current focus:** Phase 4 — tRPC Procedure Rewrites

## Current Position

Phase: 3 of 7 (Seed + Verify) — COMPLETE
Plan: 2 of 2 — COMPLETE
Status: Phase 3 complete — seed script seeded, 9/9 Playwright smoke tests pass
Last activity: 2026-03-06 — Phase 3 executed; seed script + Playwright smoke tests

Progress: [████████░░] 43%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~7 min
- Total execution time: ~0.58 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 Auth Migration | 3 | ~14 min | ~5 min |
| 03 Seed + Verify | 2 | ~21 min | ~10 min |

**Recent Trend:**
- Last 5 plans: 02-01 (2.5 min), 02-02 (3 min), 02-03 (8 min), 03-01 (5 min), 03-02 (16 min)
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Setup: Keep tRPC — procedures just point to Supabase; no layer replacement, only ctx rewrite
- Setup: No ORM — Supabase query builder sufficient; avoids disproportionate complexity for non-programmer owner
- Setup: Build custom admin UI — Supabase dashboard is developer tooling, not content management
- Setup: Payload stays installed until Phase 7 — parallel operation prevents big-bang cutover risk
- 02-01: Use getUser() not getSession() — getSession() does not validate JWT server-side
- 02-01: baseProcedure has no middleware — Supabase client injected via createTRPCContext, no wrapper needed
- 02-02: Use x-middleware-rewrite header mutation (not NextResponse.rewrite) to preserve Supabase session cookies
- 02-02: cookieOptions undefined in development — setting .ferment.com domain on localhost causes browsers to reject cookies
- 02-03: tenants.stripe_account_id is NOT NULL with no default — insert empty string placeholder until Stripe onboarding (Phase 4)
- 02-03: tenants has no user_id column — user linked via user_tenants join table after tenant creation in confirm route
- 03-01: stripe_account_id uses 'placeholder_{slug}' per tenant (not empty string — empty string conflicts on re-runs)
- 03-02: Playwright uses locator('input').first() not getByLabel — shadcn FormLabel unreliable with Playwright's label association detection
- 03-02: custom_access_token_hook had null-safety bug — fixed with coalesce(event->'claims', '{}'::jsonb); migration applied

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: `@supabase/ssr` cookie handling behavior with Next.js 15 async `cookies()` API needs runtime verification
- Phase 5: Confirm whether Supabase Storage image transforms (Imgproxy) require Pro plan or are available on Free tier

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed Phase 3 — seed script + Playwright smoke tests; 9/9 tests pass; JWT hook null-safety bug fixed
Resume file: None

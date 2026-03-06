# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 2 of 7 (Auth Migration)
Plan: 3 of 3 — COMPLETE
Status: Phase 2 complete — All 3 plans done; auth views wired to Supabase, PKCE confirm route, /pending page
Last activity: 2026-03-06 — Phase 2 Plan 03 executed; sign-in/sign-up rewired, /auth/confirm route, /pending page

Progress: [█████░░░░░] 29%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~5 min
- Total execution time: ~0.24 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 Auth Migration | 3 | ~14 min | ~5 min |

**Recent Trend:**
- Last 5 plans: 02-01 (2.5 min), 02-02 (3 min), 02-03 (8 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: JWT custom claims hook registration syntax may have changed in Supabase Auth — verify against current Supabase docs before implementing (MEDIUM confidence)
- Phase 2: `@supabase/ssr` cookie handling behavior with Next.js 15 async `cookies()` API needs runtime verification
- Phase 3: `supabase.auth.admin.createUser()` parameter shape for passwordless batch creation needs verification
- Phase 5: Confirm whether Supabase Storage image transforms (Imgproxy) require Pro plan or are available on Free tier

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed Phase 2 Plan 03 — auth views rewired to Supabase, /auth/confirm route, /pending page; Phase 2 complete
Resume file: None

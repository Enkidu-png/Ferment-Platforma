# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 2 of 7 (Auth Migration)
Plan: 2 of 3 — COMPLETE
Status: Phase 2 in progress — Plans 01-02 done; Supabase middleware + subdomain cookies configured
Last activity: 2026-03-06 — Phase 2 Plan 02 executed; middleware composed, subdomain cookie sharing in place

Progress: [████░░░░░░] 21%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~3 min
- Total execution time: ~0.09 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 Auth Migration | 2 | ~6 min | ~3 min |

**Recent Trend:**
- Last 5 plans: 02-01 (2.5 min), 02-02 (3 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: JWT custom claims hook registration syntax may have changed in Supabase Auth — verify against current Supabase docs before implementing (MEDIUM confidence)
- Phase 2: `@supabase/ssr` cookie handling behavior with Next.js 15 async `cookies()` API needs runtime verification
- Phase 3: `supabase.auth.admin.createUser()` parameter shape for passwordless batch creation needs verification
- Phase 5: Confirm whether Supabase Storage image transforms (Imgproxy) require Pro plan or are available on Free tier

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed Phase 2 Plan 01 — tRPC init rewritten, auth procedures simplified
Resume file: None

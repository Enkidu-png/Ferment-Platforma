# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP (Supabase Migration)

**Shipped:** 2026-03-13
**Phases:** 7 | **Plans:** 26 | **Timeline:** 17 days (2026-02-24 → 2026-03-13)

### What Was Built

- Full Supabase backend — 10 PostgreSQL tables, RLS tenant isolation, JWT custom claims hook
- All 8 tRPC routers migrated (ctx.db → ctx.supabase), 22/22 procedures verified
- Custom admin panel at /admin — merchant approval (Tinder-style cards), products, categories/tags, orders
- Payload CMS fully removed — zero references in src/, build passes clean
- Production deployment at ferment-platforma.vercel.app with auth, checkout, and images working
- Seed script with 3 artist tenants, 8 category trees, 20+ products, 7 Supabase Storage images
- Playwright smoke suite (22 tests, 17 pass, 5 skip gracefully for production subdomain)

### What Worked

- **Dependency-ordered phases** — building schema before auth, auth before API, API before admin forced a clean order with no backtracking
- **Supabase query builder** without ORM — kept complexity low; non-programmer owner can read and maintain code
- **gap closure plans (07-04, 07-05)** added after verification — catching production issues (cookie domain, smoke test skips) without disrupting earlier plans
- **supabaseAdmin pattern** clearly separated from anon client — admin procedures clean, no RLS conflicts
- **Seed-first approach** — having realistic seeded data made admin UI development concrete and testable
- **Smoke tests as production verification** — Playwright suite became the final acceptance gate

### What Was Inefficient

- **Early phases (1-3) predating GSD tracking** — no VERIFICATION.md, no requirements-completed frontmatter, stale traceability table; created documentation debt that the milestone audit had to untangle
- **Stale ROADMAP.md progress table** — Phase 2 and 3 checkboxes remained unchecked even after completion; required manual fix at milestone archive time
- **Supabase CLI not linked** — RLS migrations applied manually via SQL editor (not `supabase db push`); no automated migration record
- **bun vs npm discovery** — bun v1.3.4 on Windows/OneDrive creates empty node_modules dirs; wasted a debugging round before switching to npm
- **Cookie domain issue in production** — discovered only at Phase 7 smoke testing; required a gap closure plan; caught by production smoke tests, not local tests

### Patterns Established

- **ctx.supabase pattern** — anon client for RLS-enforced user-facing queries, supabaseAdmin for admin/webhook cross-tenant access
- **Two-step Supabase query pattern** — PostgREST doesn't support `.ilike()` on embedded foreign-table columns; filter in two fetches, then post-process
- **`unknown` cast for complex PostgREST joins** — Supabase TS client returns GenericStringError for aliased multi-level joins; cast via `unknown as T`
- **Cookie domain guard with endsWith(rootDomain)** — avoids hardcoding vercel.app; handles any domain mismatch
- **Gap closure plans** — when verification reveals production gaps, add decimal or numbered plans rather than modifying completed ones
- **picsum.photos with deterministic seed IDs** — consistent placeholder images across env resets

### Key Lessons

1. **Adopt GSD tracking from Phase 1** — starting verification tracking midway creates retroactive documentation debt; phases without VERIFICATION.md require audit-time archaeology
2. **Test in production early** — the cookie domain bug only appeared in production; smoke tests against PLAYWRIGHT_BASE_URL=production should be a standard step, not a Phase 7 discovery
3. **Supabase CLI should be linked from the start** — manual dashboard SQL for RLS migrations is not reproducible; link CLI in Phase 1 before any migrations run
4. **Seed data is load-bearing infrastructure** — a good idempotent seed script enables all subsequent phases; invest in it early and extend it per phase
5. **The subdomain routing workaround is fragile** — x-middleware-rewrite header works but is non-canonical; document it prominently and plan migration to NextResponse.rewrite() when custom domain is configured

### Cost Observations

- Model mix: ~100% Sonnet (claude-sonnet-4-6 balanced profile)
- Sessions: ~15 estimated (one per plan + planning sessions)
- Notable: balanced profile performed well; no opus required for this migration workload

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~15 | 7 | First GSD milestone — baseline established |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 22 Playwright smoke | N/A (E2E only) | 0 |

### Top Lessons (Verified Across Milestones)

1. Start GSD verification tracking from Phase 1 — retroactive documentation debt is expensive
2. Smoke tests against production URL should be standard, not a late-phase discovery

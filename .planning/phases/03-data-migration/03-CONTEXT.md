# Phase 3: Seed + Verify — Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 is NOT a data migration in the traditional sense. MongoDB has no real artist or product data — only collection schemas (names, field names) that informed the Phase 1 Supabase schema. There is nothing to export, remap, or import.

Phase 3 delivers two things:
1. A seed script that populates the empty Supabase database with an admin account and realistic test data
2. Playwright smoke tests that verify the app works end-to-end after the Phases 1 and 2 rewiring

</domain>

<decisions>
## Implementation Decisions

### Script execution
- Single script: `scripts/seed.ts`, run with `npx tsx scripts/seed.ts`
- Uses Supabase service-role key (already in `.env`) to bypass RLS for bulk inserts
- No dry-run flag needed — script is idempotent (see Conflict handling below)
- No over-engineering: no CLI flags, no progress bars, no abstraction layers

### Super-admin account
- Seed script creates one super-admin Supabase Auth user via the admin API
- Credentials stored in `.env.local` (e.g. `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) so they are not hardcoded
- The user gets `app_role = admin` via the JWT custom claims hook (set via user metadata or a direct `user_tenants` row with admin role)
- This account is the one used to access the Phase 6 `/admin` panel

### Test data
- 3 test tenants (artists), each with a Supabase Auth user and a `tenants` row with `status = active`
- ~20 products distributed across tenants and categories — enough to verify category filtering, multi-tenant isolation, and storefront rendering
- Products span multiple categories so category browse pages render real results
- All test users get recognisable email addresses (e.g. `artist1@test.ferment.com`) and a shared test password stored in `.env.local`

### Conflict handling
- Script checks if each record already exists before inserting (check-if-exists, skip if found)
- Idempotent: running the script twice produces no duplicates and no errors
- No wipe-and-reseed mode — too destructive during development

### Smoke tests
- Playwright tests prepared for AI execution (not manual checklist)
- Tests cover the critical paths that Phases 1 and 2 rewired:
  - `/sign-in` renders and accepts credentials
  - `/sign-up` renders with shopName field
  - Subdomain routing: `artist1.localhost:3000` resolves storefront correctly
  - `/pending` page renders
  - `/auth/confirm` route responds (does not 404)
  - Storefront product listing returns seeded products for the correct tenant
  - Category filter returns only products in that category
- Tests run against the local dev server (`npm run dev`)

### MongoDB schema reference
- No mismatch concerns raised — Phase 1 schema is assumed correct
- MongoDB collection names were the source of truth for Supabase table names; Phase 1 generated types confirm alignment
- If any mismatch is found during research, it is a Phase 4 concern (tRPC procedure rewrites), not Phase 3

</decisions>

<specifics>
## Specific Ideas

- Test tenant slugs should be URL-safe and recognisable: `ceramics-by-ana`, `woodworks-jan`, `print-studio-mia`
- Categories to seed (at minimum): whatever categories the existing app code references by name/slug — researcher should extract these from the codebase before inventing new ones
- Seed script should log clearly what it created vs. what it skipped (console.log is fine)
- Playwright config already exists or needs to be added — researcher should check

</specifics>

<deferred>
## Deferred Ideas

- None raised during discussion

</deferred>

---

*Phase: 03-data-migration (reframed: Seed + Verify)*
*Context gathered: 2026-03-06*

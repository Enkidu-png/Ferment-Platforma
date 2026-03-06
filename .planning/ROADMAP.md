# Roadmap: Ferment Platforma — Supabase Migration

## Overview

The migration replaces Payload CMS + MongoDB + Vercel Blob with Supabase (PostgreSQL + Auth + Storage) while keeping every user-facing capability intact. The build order is non-negotiable: schema and security policies must exist before auth can be wired, auth must be wired before tRPC procedures can be rewritten, data must be migrated before storage URLs can be updated, all procedures must work before the admin UI can be built on top of them, and Payload is removed last to keep a working fallback until everything is verified. Seven phases emerge directly from this dependency chain.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Supabase project, PostgreSQL schema, RLS policies, JWT custom claims hook, and client factories
- [ ] **Phase 2: Auth Migration** - Supabase Auth replaces Payload auth; middleware and tRPC context updated
- [ ] **Phase 3: Data Migration** - All 8 MongoDB collections exported, ID-remapped, and imported into Supabase PostgreSQL
- [ ] **Phase 4: API Layer Migration** - All 8 tRPC routers rewritten to use Supabase client; Stripe webhook updated
- [ ] **Phase 5: Storage Migration** - All Vercel Blob files moved to Supabase Storage; all URLs updated across database
- [ ] **Phase 6: Custom Admin UI** - `/admin` route built with full merchant, product, category, and order management
- [ ] **Phase 7: Payload Removal + Cutover** - Payload CMS fully removed; password resets sent; production go-live

## Phase Details

### Phase 1: Foundation
**Goal**: Supabase project is provisioned with all database tables, security policies, auth token configuration, and client libraries in place — the complete infrastructure that all subsequent phases build on
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, FOUN-06
**Success Criteria** (what must be TRUE):
  1. All 8 tables exist in Supabase PostgreSQL and `supabase gen types` produces a `types.ts` file with no errors
  2. An unauthenticated browser request to the Supabase anon key can read products and storefront data but cannot read other tenants' private data
  3. An authenticated request carries a JWT that includes `tenant_id` and `app_role` claims (verified via Supabase JWT inspector)
  4. Four Supabase client factory files exist in `src/lib/supabase/` and the app compiles with no TypeScript errors
  5. Environment variables for Supabase are configured and the app connects to Supabase without connection errors
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Supabase project setup + client factory files
- [x] 01-02-PLAN.md — Database schema (10 tables) + RLS policies
- [x] 01-03-PLAN.md — JWT custom claims hook + generated types

### Phase 2: Auth Migration
**Goal**: Supabase Auth fully replaces Payload authentication — users can log in, stay logged in across browser sessions, and the tRPC context uses the Supabase client so all downstream procedure rewrites can proceed
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. An artist can log in with email and password and reach their dashboard without errors
  2. After browser refresh, the artist is still logged in (session cookie persists)
  3. A new artist can register, and a pending tenant row appears in the tenants table
  4. Subdomain routing continues working after the middleware rewrite (visiting artist.ferment.com still resolves the correct storefront)
  5. `ctx.supabase` is available in tRPC procedures and `protectedProcedure` rejects unauthenticated requests with a 401
**Plans**: 3 plans
Plans:
- [ ] 02-01-PLAN.md — tRPC context rewrite (ctx.supabase + protectedProcedure) + auth procedures simplification + schemas update
- [ ] 02-02-PLAN.md — Middleware composition (Supabase session refresh + subdomain routing) + subdomain cookie config
- [ ] 02-03-PLAN.md — Sign-in/sign-up views rewire + /auth/confirm route + /pending page

### Phase 3: Data Migration
**Goal**: All real artist and product data from MongoDB is faithfully preserved in Supabase PostgreSQL with all relationships intact, ready for the application to use
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. The migration script runs in dry-run mode and reports the expected row counts for all 8 collections with zero errors
  2. After live run, every tenant row has a matching Supabase Auth user record and every product row has a valid tenant FK
  3. Stripe account IDs and webhook metadata reference the new PostgreSQL UUIDs (no MongoDB ObjectId strings remain in orders or Stripe metadata)
  4. Running the migration script a second time produces no duplicate rows and no errors (idempotent)
**Plans**: TBD

### Phase 4: API Layer Migration
**Goal**: Every tRPC router reads and writes data through the Supabase client — the application works end-to-end using PostgreSQL, with tenant isolation enforced by RLS on every user-facing query
**Depends on**: Phase 2, Phase 3
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07
**Success Criteria** (what must be TRUE):
  1. A buyer can browse products on an artist's storefront (subdomain) and products from other tenants are not returned in any query
  2. An artist can add, edit, and delete their own products through the application UI
  3. A buyer can complete checkout and a Stripe webhook creates an order row in the orders table with the correct UUID product and tenant references
  4. No tRPC procedure references `ctx.db` or any Payload collection name — only `ctx.supabase.from(...)` calls remain
**Plans**: TBD

### Phase 5: Storage Migration
**Goal**: All product images and media files are served from Supabase Storage — no Vercel Blob URLs remain anywhere in the database or application code
**Depends on**: Phase 3
**Requirements**: STOR-01, STOR-02, STOR-03, STOR-04, STOR-05
**Success Criteria** (what must be TRUE):
  1. All product images load correctly in the storefront (no broken image links, no requests to `blob.vercel-storage.com`)
  2. A search across all database text columns for `blob.vercel-storage.com` returns zero matches
  3. New file uploads from the artist dashboard save to Supabase Storage and the returned URL is a Supabase Storage URL
  4. `next.config.js` allows Supabase Storage image domain and Next.js image optimization works for product images
**Plans**: TBD

### Phase 6: Custom Admin UI
**Goal**: A super-admin user can manage the entire marketplace — approving merchants, managing products, categories, tags, and viewing orders — through a custom admin panel at `/admin`
**Depends on**: Phase 4
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06
**Success Criteria** (what must be TRUE):
  1. Visiting `/admin` without super-admin credentials redirects to login (non-admins cannot access the panel)
  2. A super-admin can view the list of pending merchant applications and approve or reject one — the merchant's shop goes live (or is blocked) immediately after approval
  3. A super-admin can edit a product from any merchant and the change is reflected on the storefront
  4. A super-admin can create, rename, and delete a category and the change is reflected in the buyer-facing category filter
  5. A super-admin can view all orders with merchant, product, and buyer information displayed
**Plans**: TBD

### Phase 7: Payload Removal + Cutover
**Goal**: Payload CMS is fully removed from the codebase, existing artists have received password reset emails, and the application is live on Supabase with no Payload code or MongoDB connection remaining
**Depends on**: Phase 5, Phase 6
**Requirements**: CLEN-01, CLEN-02, CLEN-03, CLEN-04, CLEN-05
**Success Criteria** (what must be TRUE):
  1. `npm run build` completes with zero errors and zero references to `payload`, `@payloadcms`, or `mongodb` in the build output
  2. A search of the entire `src/` directory for `payloadcms` and `payload.config` returns zero matches
  3. All existing artists have received a password reset email and can log into the Supabase-backed platform
  4. The production application serves the marketplace correctly — storefronts load, checkout works, images display — with no Payload or MongoDB in the dependency tree
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in dependency order: 1 → 2 → 3 (parallel with 2) → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-06 |
| 2. Auth Migration | 0/3 | Planned | - |
| 3. Data Migration | 0/TBD | Not started | - |
| 4. API Layer Migration | 0/TBD | Not started | - |
| 5. Storage Migration | 0/TBD | Not started | - |
| 6. Custom Admin UI | 0/TBD | Not started | - |
| 7. Payload Removal + Cutover | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-24*
*Last updated: 2026-03-06 — Phase 2 plans written*

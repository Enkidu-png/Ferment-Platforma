# Requirements: Ferment Platforma — Supabase Migration

**Defined:** 2026-02-24
**Core Value:** The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.

## v1 Requirements

### Foundation

- [ ] **FOUN-01**: Supabase project connected with database, auth, and storage configured in environment
- [ ] **FOUN-02**: All 8 PostgreSQL tables created (users, products, categories, tags, tenants, orders, reviews, media)
- [ ] **FOUN-03**: Row Level Security policies implement tenant isolation (products and media scoped to owning tenant)
- [ ] **FOUN-04**: RLS anonymous-read policies allow unauthenticated buyers to browse products and storefronts
- [ ] **FOUN-05**: JWT custom claims hook embeds `tenant_id` and `app_role` into every auth token
- [ ] **FOUN-06**: Four Supabase client factories created (server component, middleware, client component, service role)

### Auth

- [ ] **AUTH-01**: User can log in with email and password via Supabase Auth
- [ ] **AUTH-02**: User session persists across browser refresh (Supabase SSR cookies)
- [ ] **AUTH-03**: Next.js middleware updated to compose Supabase session refresh with subdomain routing as a single Response pipeline
- [ ] **AUTH-04**: tRPC context updated — `ctx.db` replaced with `ctx.supabase`, `protectedProcedure` uses Supabase `getUser()`
- [ ] **AUTH-05**: All existing artists receive a password reset email so they can log in after migration
- [ ] **AUTH-06**: New artist can register and create a store (Supabase Auth account + tenants table row, status: pending)

### Data Migration

- [ ] **DATA-01**: MongoDB data export script created for all 8 collections
- [ ] **DATA-02**: ID remapping table (`_id_map`) created to map MongoDB ObjectIds to PostgreSQL UUIDs
- [ ] **DATA-03**: All existing MongoDB data imported into Supabase PostgreSQL with relationships preserved
- [ ] **DATA-04**: Stripe account IDs and webhook metadata updated to reference new UUIDs
- [ ] **DATA-05**: Migration script supports dry-run mode for validation before live commit

### API Layer

- [x] **API-01**: Products tRPC router rewritten to use Supabase client
- [x] **API-02**: Auth tRPC router rewritten to use Supabase Auth
- [x] **API-03**: Tenants tRPC router rewritten to use Supabase client
- [x] **API-04**: Orders tRPC router rewritten to use Supabase client
- [x] **API-05**: Checkout tRPC router and Stripe webhook handler updated for UUID format
- [x] **API-06**: Categories and Tags tRPC routers rewritten to use Supabase client
- [x] **API-07**: All user-facing procedures use anon client (RLS enforced); Stripe webhook uses service-role client (RLS bypassed)

### Storage

- [x] **STOR-01**: Supabase Storage bucket created with public-read access policy for product images
- [x] **STOR-02**: All files re-uploaded from Vercel Blob to Supabase Storage
- [x] **STOR-03**: All media URLs in the database updated to Supabase Storage URLs
- [x] **STOR-04**: `next.config.js` updated to allow Supabase Storage image domain
- [x] **STOR-05**: New file uploads use Supabase Storage (upload procedure updated)

### Admin UI

- [x] **ADMN-01**: Custom admin panel at `/admin` route, protected to super-admin users only
- [x] **ADMN-02**: Admin can view pending merchant applications and approve or reject them
- [x] **ADMN-03**: Approved merchant shop goes live; rejected merchant receives notification and cannot list products
- [x] **ADMN-04**: Admin can view, edit, and delete any product across all merchants
- [x] **ADMN-05**: Admin can create, edit, and delete categories and tags
- [ ] **ADMN-06**: Admin can view all orders with merchant, product, and buyer details

### Cleanup

- [ ] **CLEN-01**: All Payload CMS packages removed from `package.json`
- [ ] **CLEN-02**: Payload configuration and collection files removed (`payload.config.ts`, `src/collections/`, generated types)
- [ ] **CLEN-03**: MongoDB connection removed
- [ ] **CLEN-04**: Vercel Blob dependency removed (replaced by Supabase Storage)
- [ ] **CLEN-05**: App builds and runs successfully with zero Payload references in codebase

## v2 Requirements

### Enhanced Admin

- **ADMN-V2-01**: Product-level approval — each product requires admin approval before going live
- **ADMN-V2-02**: Artist analytics dashboard — sales, views, conversion per artist

### Discovery

- **DISC-V2-01**: Polish-language full-text search for products
- **DISC-V2-02**: Supabase Realtime order notifications for merchants

## Out of Scope

| Feature | Reason |
|---------|--------|
| New marketplace features | Migration only — no new functionality until migration is stable |
| Mobile app | Web-first |
| Payments outside Poland | Existing Stripe configuration; expand later |
| Product-level approval | Deferred to v2 — merchant approval covers quality control for now |
| WYSIWYG rich text editor in admin | Complexity not worth it; plain text / markdown is sufficient |
| ORM (Drizzle, Prisma) | Supabase query builder is sufficient; adding ORM increases complexity for non-programmer owner |
| GraphQL | Removed with Payload; not needed with tRPC + Supabase client |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 — Foundation | Pending |
| FOUN-02 | Phase 1 — Foundation | Pending |
| FOUN-03 | Phase 1 — Foundation | Pending |
| FOUN-04 | Phase 1 — Foundation | Pending |
| FOUN-05 | Phase 1 — Foundation | Pending |
| FOUN-06 | Phase 1 — Foundation | Pending |
| AUTH-01 | Phase 2 — Auth Migration | Pending |
| AUTH-02 | Phase 2 — Auth Migration | Pending |
| AUTH-03 | Phase 2 — Auth Migration | Pending |
| AUTH-04 | Phase 2 — Auth Migration | Pending |
| AUTH-05 | Phase 2 — Auth Migration | Pending |
| AUTH-06 | Phase 2 — Auth Migration | Pending |
| DATA-01 | Phase 3 — Data Migration | Pending |
| DATA-02 | Phase 3 — Data Migration | Pending |
| DATA-03 | Phase 3 — Data Migration | Pending |
| DATA-04 | Phase 3 — Data Migration | Pending |
| DATA-05 | Phase 3 — Data Migration | Pending |
| API-01 | Phase 4 — API Layer Migration | Complete |
| API-02 | Phase 4 — API Layer Migration | Complete |
| API-03 | Phase 4 — API Layer Migration | Complete |
| API-04 | Phase 4 — API Layer Migration | Complete |
| API-05 | Phase 4 — API Layer Migration | Complete |
| API-06 | Phase 4 — API Layer Migration | Complete |
| API-07 | Phase 4 — API Layer Migration | Complete |
| STOR-01 | Phase 5 — Storage Migration | Complete |
| STOR-02 | Phase 5 — Storage Migration | Complete |
| STOR-03 | Phase 5 — Storage Migration | Complete |
| STOR-04 | Phase 5 — Storage Migration | Complete |
| STOR-05 | Phase 5 — Storage Migration | Complete |
| ADMN-01 | Phase 6 — Custom Admin UI | Complete |
| ADMN-02 | Phase 6 — Custom Admin UI | Complete |
| ADMN-03 | Phase 6 — Custom Admin UI | Complete |
| ADMN-04 | Phase 6 — Custom Admin UI | Complete |
| ADMN-05 | Phase 6 — Custom Admin UI | Complete |
| ADMN-06 | Phase 6 — Custom Admin UI | Pending |
| CLEN-01 | Phase 7 — Payload Removal + Cutover | Pending |
| CLEN-02 | Phase 7 — Payload Removal + Cutover | Pending |
| CLEN-03 | Phase 7 — Payload Removal + Cutover | Pending |
| CLEN-04 | Phase 7 — Payload Removal + Cutover | Pending |
| CLEN-05 | Phase 7 — Payload Removal + Cutover | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — traceability updated after roadmap creation*

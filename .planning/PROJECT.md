# Ferment Platforma

## What This Is

Ferment Platforma is a Polish multi-artist marketplace where each artist gets their own subdomain-based shop. Buyers can browse art and purchase products (Poland only). The v1.0 migration is complete — the backend has been fully replaced from MongoDB + Payload CMS to Supabase (PostgreSQL + Auth + Storage), with a custom admin panel replacing the Payload admin UI. The app is live in production.

## Core Value

The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.

## Requirements

### Validated

<!-- Shipped in v1.0 — confirmed working in production -->

- ✓ Multi-tenant subdomain routing (e.g., artist.ferment.com) — existing
- ✓ Product browsing with category filters — existing
- ✓ Cart management (Zustand, localStorage) — existing
- ✓ Stripe checkout and webhook order creation — existing
- ✓ Artist registration and store creation — existing
- ✓ tRPC API layer with type-safe procedures — existing
- ✓ SSR with React Query hydration — existing
- ✓ Supabase PostgreSQL replaces MongoDB as the database — v1.0
- ✓ All 8 collections migrated to Supabase tables — v1.0
- ✓ Supabase Auth replaces Payload authentication (login, sessions, accounts) — v1.0
- ✓ Supabase Storage replaces Vercel Blob (files moved, URLs updated in DB) — v1.0
- ✓ Custom admin UI replaces Payload Admin panel (/admin route) — v1.0
- ✓ Payload CMS fully removed from codebase and dependencies — v1.0
- ✓ Multi-tenancy reimplemented using Supabase Row Level Security — v1.0

### Active

<!-- v2 priorities — start with /gsd:new-milestone -->

- [ ] Admin product image upload — `mediaRouter.createRow` backend exists but no admin UI form calls it
- [ ] Wildcard DNS + custom domain — required for production storefront subdomain and smoke tests
- [ ] Product-level approval — each product requires admin approval before going live (ADMN-V2-01)
- [ ] Artist analytics dashboard — sales, views, conversion per artist (ADMN-V2-02)
- [ ] Polish-language full-text search for products (DISC-V2-01)
- [ ] Supabase Realtime order notifications for merchants (DISC-V2-02)

### Out of Scope

- New marketplace features during migration — ✓ migration complete, can now add features
- Mobile app — web-first; PWA works well on mobile
- Payments outside Poland — existing Stripe configuration; expand later
- WYSIWYG rich text editor in admin — plain text/markdown sufficient
- ORM (Drizzle, Prisma) — Supabase query builder sufficient
- GraphQL — removed with Payload; not needed with tRPC + Supabase client
- Offline mode — real-time is core value

## Context

**Codebase state (v1.0):**
- 12,859 LOC TypeScript/TSX
- Zero Payload/MongoDB references in `src/`
- 26 plans executed across 7 phases
- Production: https://ferment-platforma.vercel.app

**Tech stack:**
- Next.js 15, tRPC, React Query, Zustand, Stripe, Tailwind CSS v4, shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)

**Known infrastructure gaps:**
- Supabase CLI not linked — RLS migrations applied manually via dashboard SQL editor
- `db:types` script has `<PROJECT_ID>` placeholder — fill in Supabase project ID before using
- `.env.example` has stale Payload entries (DATABASE_URI, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN)
- Subdomain routing uses x-middleware-rewrite header (non-canonical) — migrate to NextResponse.rewrite() when custom domain configured
- Storefront smoke tests hardcode localhost:3000 subdomains — cannot run against production without wildcard DNS

**Owner profile:** Non-programmer, relies on AI-assisted development — simpler, more readable code is a priority.

## Constraints

- **Tech**: Keep Next.js 15, tRPC, React Query, Zustand, Stripe — do not replace these
- **Geography**: Poland-only payments (existing Stripe configuration)
- **Compatibility**: Multi-tenant subdomain routing must continue working
- **Simplicity**: Owner is non-programmer — minimize complexity, avoid ORMs, GraphQL, etc.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep tRPC | Maintains type safety; procedures just point to Supabase instead of Payload | ✓ Good — minimal refactor, all 8 routers migrated cleanly |
| Move to Supabase Storage | One platform (DB + Auth + Storage) simpler to manage long-term | ✓ Good — Vercel Blob removed, images serving correctly |
| Build custom admin UI | Supabase dashboard is developer-tool, not content management | ✓ Good — non-technical owner has proper UX at /admin |
| No real MongoDB migration | Dev environment — no real data to migrate; seed script sufficient | ✓ Good — DATA-01..05 superseded, seed is idempotent |
| x-middleware-rewrite header pattern | NextResponse.rewrite() can't coexist with Supabase cookie mutation | ⚠️ Revisit — non-canonical; migrate to NextResponse.rewrite() when custom domain configured |
| supabaseAdmin for admin procedures | RLS would restrict admin to own tenant; admin needs cross-tenant access | ✓ Good — pattern works well, clearly documented |
| Seed with picsum.photos images | Real images needed for admin UI dev; deterministic IDs ensure idempotency | ✓ Good |
| force-dynamic on home layout | layout calls createTRPCContext which reads cookies() | ✓ Good — required for Next.js 15 build to pass |
| npm install over bun install | bun v1.3.4 on Windows/OneDrive creates empty node_modules dirs | ✓ Good — npm correctly populates packages |
| Cookie domain guard with endsWith | Handles any domain mismatch without hardcoding vercel.app | ✓ Good |

---
*Last updated: 2026-03-13 after v1.0 milestone*

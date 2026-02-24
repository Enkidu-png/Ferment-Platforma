# Ferment Platforma — Supabase Migration

## What This Is

Ferment Platforma is a Polish multi-artist marketplace where each artist gets their own subdomain-based shop. Buyers can browse art and purchase products (Poland only). The project is migrating its backend from MongoDB + Payload CMS to Supabase — replacing the database, authentication, and file storage — plus replacing the Payload admin panel with a simple custom admin UI built into the app.

## Core Value

The marketplace works exactly as before — artists manage their shops, buyers browse and buy — but the backend is Supabase, making the codebase maintainable with AI assistance.

## Requirements

### Validated

<!-- Existing capabilities — already working in the current codebase. -->

- ✓ Multi-tenant subdomain routing (e.g., artist.ferment.com) — existing
- ✓ Product browsing with category filters — existing
- ✓ Cart management (Zustand, localStorage) — existing
- ✓ Stripe checkout and webhook order creation — existing
- ✓ Artist registration and store creation — existing
- ✓ tRPC API layer with type-safe procedures — existing
- ✓ SSR with React Query hydration — existing

### Active

<!-- Migration goals — what this project delivers. -->

- [ ] Supabase PostgreSQL replaces MongoDB as the database
- [ ] All 8 collections migrated to Supabase tables (Users, Products, Categories, Tags, Tenants, Orders, Reviews, Media)
- [ ] Existing MongoDB data migrated and preserved in Supabase
- [ ] Supabase Auth replaces Payload authentication (login, sessions, user accounts)
- [ ] Supabase Storage replaces Vercel Blob (all existing files moved, URLs updated in DB)
- [ ] Custom simple admin UI replaces Payload Admin panel (/admin route)
- [ ] Payload CMS fully removed from the codebase and dependencies
- [ ] Multi-tenancy reimplemented using Supabase Row Level Security

### Out of Scope

- New marketplace features — migration only, no new functionality
- Mobile app — web-first
- Payments outside Poland — deferred

## Context

- **Tech stack kept**: Next.js 15, tRPC, React Query, Zustand, Stripe, Tailwind CSS v4, shadcn/ui
- **Being replaced**: Payload CMS 3.x, @payloadcms/* packages, MongoDB (@payloadcms/db-mongodb)
- **Current collections**: Users, Media, Categories, Products, Tags, Tenants, Orders, Reviews
- **Multi-tenancy**: Currently via Payload multi-tenant plugin — needs reimplementation with Supabase RLS policies
- **File storage**: Vercel Blob URLs exist in Media collection — all must be re-uploaded to Supabase Storage and URLs updated
- **Owner profile**: Non-programmer, relies on AI-assisted development — simpler, more readable code is a priority

## Constraints

- **Tech**: Keep Next.js 15, tRPC, React Query, Zustand, Stripe — do not replace these
- **Geography**: Poland-only payments (existing Stripe configuration)
- **Data**: Real artist and product data in MongoDB must be preserved through migration
- **Compatibility**: Multi-tenant subdomain routing must continue working post-migration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep tRPC | Maintains type safety; tRPC procedures just point to Supabase instead of Payload — minimal refactor needed | — Pending |
| Move to Supabase Storage | One platform (DB + Auth + Storage) simpler to manage long-term | — Pending |
| Build custom admin UI | Supabase dashboard is developer-tool, not content management; non-technical owner needs better UX | — Pending |
| Migrate existing data | Real artist/product data must be preserved — migration script required | — Pending |

---
*Last updated: 2026-02-24 after initialization*

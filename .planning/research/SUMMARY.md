# Project Research Summary

**Project:** Ferment Platforma — Payload CMS + MongoDB to Supabase Migration
**Domain:** Multi-tenant digital marketplace (brownfield migration)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

Ferment Platforma is a Polish multi-artist digital marketplace built on Next.js 15 App Router, tRPC, and React Query. The system currently runs on Payload CMS with MongoDB for data storage and Vercel Blob for file storage. The migration goal is to replace that backend entirely with Supabase (PostgreSQL + Auth + Storage) while keeping the frontend layer, Stripe integration, and subdomain-based multi-tenancy logic intact. This is a brownfield swap-out migration, not a greenfield build — the business logic, UI components, and tRPC layer are retained; only the data and auth layers change.

The recommended approach is a layered, dependency-ordered migration that builds the Supabase foundation first (schema, RLS, auth) before touching any application code. The critical architectural improvement this migration delivers is moving tenant isolation from fragile application-layer JavaScript filtering (Payload's multi-tenant plugin) into Postgres Row Level Security policies — a fundamental security upgrade that makes cross-tenant data leaks structurally impossible rather than dependent on per-procedure discipline. The entire stack (two packages: `@supabase/supabase-js` and `@supabase/ssr`) is simpler than what it replaces.

The highest risks are concentrated in the data migration phase: MongoDB ObjectIds cannot be used as PostgreSQL foreign keys and must be remapped to UUIDs via a mapping table; Payload's bcrypt password hashes cannot be imported into Supabase Auth (all existing users need forced password resets); and Vercel Blob URLs appear in multiple database locations and must all be replaced atomically after files are re-uploaded to Supabase Storage. These risks are well-understood and preventable with a disciplined migration script.

---

## Key Findings

### Recommended Stack

The stack addition is minimal: two packages replace the entire Payload CMS ecosystem. `@supabase/supabase-js` v2.x is the universal Supabase client handling database queries, auth, and storage. `@supabase/ssr` v0.5.x (the official replacement for the deprecated `@supabase/auth-helpers-nextjs`) provides cookie-based session management for Next.js 15 App Router across Server Components, Route Handlers, and middleware.

No ORM is needed. The Supabase JS client's PostgREST query builder handles all CRUD for this app's 8 tables. Drizzle and Prisma were evaluated and rejected: both add schema files, migration CLIs, and type generation pipelines that are disproportionate complexity for a small marketplace managed by a non-programmer owner. Raw SQL for complex queries is available via Supabase's `.rpc()` mechanism if needed post-migration.

**Core technologies:**
- `@supabase/supabase-js` v2.x: universal client (DB, Auth, Storage) — replaces Payload CMS
- `@supabase/ssr` v0.5.x: cookie adapter for Next.js 15 App Router — required for server-side session management
- Supabase Auth: email/password sessions with JWT custom claims — replaces Payload's cookie auth
- Supabase Storage: file hosting with CDN — replaces `@payloadcms/storage-vercel-blob`
- PostgreSQL with RLS: tenant isolation at database level — replaces `@payloadcms/plugin-multi-tenant`

**Packages to remove:** `payload`, `@payloadcms/db-mongodb`, `@payloadcms/next`, `@payloadcms/payload-cloud`, `@payloadcms/plugin-multi-tenant`, `@payloadcms/richtext-lexical`, `@payloadcms/storage-vercel-blob`, `graphql`

See `.planning/research/STACK.md` for full configuration patterns including the four Supabase client factories, tRPC context rewrite, and middleware composition.

### Expected Features

The migration has 10 table-stakes items (TS-1 through TS-10) that must all be completed for the app to function. The dependency chain is strict: Auth enables everything; schema enables RLS and data migration; tRPC rewrite enables admin UI.

**Must have (table stakes — migration is incomplete without these):**
- TS-1: Supabase Auth (email/password, session cookies, JWT custom claims for roles) — replaces Payload auth
- TS-2: RLS policies for all 8 tables — replaces Payload multi-tenant plugin; highest-stakes correctness requirement
- TS-3: Supabase Storage bucket + upload policies + migration of existing files — replaces Vercel Blob
- TS-4 through TS-7: PostgreSQL table schemas (Users, Tenants, Products/Categories/Tags, Orders/Reviews/Media)
- TS-8: tRPC context rewrite (`ctx.db` → `ctx.supabase`) cascading to all 8 routers
- TS-9: Custom admin UI replacing Payload's `/admin` panel
- TS-10: Data migration script (MongoDB export → UUID remapping → PostgreSQL insert → Storage migration)

**Should have (low cost, high value, include in migration milestone):**
- D-5: Password reset flow via Supabase Auth — mandatory anyway since bcrypt hashes cannot be migrated
- D-3: Supabase Storage image transforms (on-the-fly resize via URL params) — zero backend cost once files are in Supabase Storage; replaces Payload's `sharp` processing

**Defer to post-migration milestone:**
- D-1: PostgreSQL full-text search with Polish tsvector (needs testing for Polish language tokenisation)
- D-2: Supabase Realtime live order notifications (nice-to-have, not blocking)
- D-4: Audit log via PostgreSQL triggers (nice-to-have)
- D-6: OAuth providers / magic link auth (future feature)

**Explicit anti-features (do not build):**
- Do not rebuild a rich text editor — use plain markdown textarea; store descriptions as TEXT in PostgreSQL
- Do not use PostgREST or Supabase GraphQL directly — keep all data access through tRPC
- Do not use Supabase Edge Functions — keep Stripe webhook in existing Next.js API route
- Do not add any new marketplace features during the migration milestone

See `.planning/research/FEATURES.md` for full feature dependency graph and detailed schema SQL.

### Architecture Approach

The post-migration architecture is identical in shape to the current system but moves security enforcement from the application layer to the database. The four-layer stack (Browser → Next.js App Router → tRPC → Supabase) remains unchanged. Tenant isolation moves from Payload's JavaScript-level `where` clauses to Postgres RLS policies that evaluate inside the query engine before any data reaches the application. The tRPC context changes from `{ db: PayloadInstance }` to `{ supabase: SupabaseClient }`, which cascades through all 8 routers as a mechanical but large refactor.

The middleware must compose two concerns on a single `NextResponse` object: Supabase session refresh (which must run first, calling `supabase.auth.getUser()` — not `getSession()`) and the existing subdomain tenant routing (hostname extraction and URL rewrite). These cannot be separate middleware functions; they must share the same response object so that refreshed session cookies are forwarded correctly when a rewrite is returned.

**Major components:**
1. `src/middleware.ts` — session refresh + subdomain-to-path rewrite, composed as single pipeline
2. `src/lib/supabase/` — four client factories: server (Server Components), middleware, client (browser-only), admin (service role, bypasses RLS)
3. `src/trpc/init.ts` — `baseProcedure` (anon client), `protectedProcedure` (auth check), `adminProcedure` (role guard)
4. PostgreSQL schema — 8 tables with FK relationships replacing MongoDB collections
5. RLS policies — JWT custom claims hook (`custom_access_token_hook`) embeds `tenant_id` and `app_role` in every JWT; helper functions `auth.tenant_id()` and `auth.is_super_admin()` used in policies
6. `src/app/(admin)/` — custom admin UI, Server Component layout with role guard, all data via `adminProcedure`
7. Data migration script — ID mapping table, two-pass FK rewrite, Vercel Blob to Supabase Storage re-upload

See `.planning/research/ARCHITECTURE.md` for the full build order, complete SQL schema, all RLS policies, and data flow diagrams.

### Critical Pitfalls

1. **MongoDB ObjectId → UUID foreign key remapping (Pitfall 1)** — Build an `_id_map` table before migration. Insert all new UUID-keyed rows first, then run a second pass rewriting every FK column. Never use MongoDB hex strings as PostgreSQL primary keys. One missed FK reference = silent orphaned records and broken RLS.

2. **Password hash incompatibility (Pitfall 2)** — Payload's bcrypt hashes cannot be imported into Supabase Auth. Every existing user needs a forced password reset. Use `supabase.auth.admin.createUser({ email, email_confirm: true })` to create auth records without passwords, then trigger password-reset emails before or at cutover. Communicate to all artists in advance.

3. **Service role client bypassing RLS in tRPC procedures (Pitfall 3)** — Use the anon client (with user's session JWT) for all user-facing tRPC queries. Reserve the service role client exclusively for the Stripe webhook handler and admin bulk operations. RLS enforces tenant isolation; the anon client proves RLS works. One procedure using the service role = all data visible to all users.

4. **Middleware composition conflict: auth refresh vs. subdomain rewrite (Pitfall 9)** — The Supabase session refresh mutates the response object's cookies. The URL rewrite must use the same response object. Never call `NextResponse.rewrite()` on a separate new response after the auth step — this discards refreshed session cookies. Structure middleware as a single pipeline on one response object.

5. **Vercel Blob URLs hardcoded across multiple database locations (Pitfall 5)** — URLs appear in the `media` table, in product records as relationship references, potentially in serialized text fields, and in Stripe metadata. Migrate files to Supabase Storage first (capturing the old→new URL mapping), then run a global `UPDATE ... SET column = REPLACE(column, old, new)` across all text columns. Search for `blob.vercel-storage.com` in the entire database before cutover to find every occurrence.

See `.planning/research/PITFALLS.md` for 19 pitfalls with specific code-level prevention strategies and phase-specific warning tables.

---

## Implications for Roadmap

Based on the dependency chain established in research, the build order is non-negotiable: schema before auth (JWT custom claims reference the users table), auth before procedures (tRPC context depends on Supabase client setup), data migration before storage migration (media rows must exist before updating their URLs), procedures before admin UI, Payload removal last. Seven phases emerge naturally from this dependency ordering.

### Phase 1: Foundation — Supabase Project + Schema + RLS

**Rationale:** All subsequent work depends on the database schema and security policies existing in Supabase. Auth JWT custom claims reference the users and user_tenants tables. The data migration script inserts into these tables. No code migration can happen without this foundation.

**Delivers:** Supabase project provisioned; all 8 PostgreSQL tables created with indexes; all RLS policies in place and tested; JWT custom claims hook deployed; `supabase gen types` run to generate `src/lib/supabase/types.ts`; four Supabase client factory files in `src/lib/supabase/`; environment variables updated.

**Addresses:** TS-4, TS-5, TS-6, TS-7 (all table schemas), TS-2 (RLS policies)

**Avoids:** Pitfall 4 (junction table RLS gaps — check every table), Pitfall 10 (public storefront RLS — test with anon key AND authenticated key), Pitfall 14 (RLS N+1 — add indexes alongside policies)

### Phase 2: Auth Migration — Supabase Auth + Middleware + tRPC Context

**Rationale:** Auth is the single dependency that unblocks all tRPC procedure rewrites. The middleware must be updated before any server-rendered page can use Supabase sessions. The tRPC context rewrite (`ctx.db` → `ctx.supabase`) must be completed before any individual procedure can be migrated.

**Delivers:** `src/middleware.ts` updated (session refresh + subdomain routing as single pipeline); `src/trpc/init.ts` rewritten (`baseProcedure`, `protectedProcedure`, `adminProcedure`); auth router rewritten (register, login, logout, session); new Context TypeScript type defined explicitly before touching any procedures.

**Addresses:** TS-1 (Supabase Auth), TS-8 (tRPC context rewrite)

**Uses:** `@supabase/ssr` cookie client factory pattern, JWT custom claims for `app_role`

**Avoids:** Pitfall 2 (plan forced password reset before cutover), Pitfall 3 (use anon client not service role in tRPC), Pitfall 6 (define Context type before touching procedures), Pitfall 7 (use `@supabase/ssr` throughout, never `createClient` from base package in server context), Pitfall 8 (middleware refreshes session on every request), Pitfall 9 (auth + subdomain rewrite composed on single response object)

### Phase 3: Data Migration Script

**Rationale:** Real artist and product data must be preserved. The migration script must exist before any cutover date can be set. It runs after schema is ready (Phase 1) but is independent of the auth/tRPC migration (Phase 2). Developing it in parallel with Phase 2 is possible.

**Delivers:** Idempotent Node.js migration script that: exports all 8 MongoDB collections via Payload API; builds `_id_map` table (MongoDB hex → PostgreSQL UUID); inserts categories, tags, tenants, users (via Supabase Auth admin API), user_tenants, products, product_tags, orders, reviews in dependency order; handles richText Lexical JSON → plain text conversion; creates Supabase Auth users without passwords (triggering password reset emails); is safe to re-run on failure.

**Addresses:** TS-10 (data migration)

**Avoids:** Pitfall 1 (two-pass ID remapping — never use hex string as PK), Pitfall 2 (createUser without password, force reset), Pitfall 11 (keep `_id_map` table for 30 days post-cutover for in-flight Stripe webhooks)

### Phase 4: tRPC Procedure Migration

**Rationale:** With the new tRPC context in place (Phase 2) and schemas defined (Phase 1), each router can be migrated module by module. This is the largest phase by volume but is mechanically predictable. The Stripe webhook handler is updated here too.

**Delivers:** All 8 tRPC routers rewritten to use `ctx.supabase.from('table').select(...)` instead of `ctx.db.find({collection: ...})`; Stripe webhook handler updated to use service role client with UUID product IDs; cart localStorage key scoped to tenant slug; all `depth > 0` Payload queries replaced with explicit PostgREST nested selects.

**Addresses:** TS-8 (all procedure rewrites)

**Avoids:** Pitfall 3 (anon vs service role client boundaries), Pitfall 6 (`ctx.user.tenants[0]` pattern eliminated), Pitfall 11 (webhook ID format detection), Pitfall 15 (audit all `depth > 0` Payload calls), Pitfall 16 (cart localStorage tenant scoping)

### Phase 5: Storage Migration

**Rationale:** Depends on Phase 3 (media rows must exist in PostgreSQL before updating their URLs). Storage migration requires the old→new URL mapping to be captured before updating any database records. This must complete before any Payload code is removed.

**Delivers:** Supabase Storage `media` bucket created (public); upload policies set; all Vercel Blob files downloaded and re-uploaded to Supabase Storage; `old_url → new_url` mapping captured; global find-and-replace run across all text columns in all tables (`UPDATE ... SET col = REPLACE(col, old, new)`); `next.config.js` `remotePatterns` updated from Vercel Blob domain to Supabase Storage domain; `BLOB_READ_WRITE_TOKEN` environment variable removed.

**Addresses:** TS-3 (Supabase Storage), D-3 (image transforms — zero extra cost, URL parameter change only)

**Avoids:** Pitfall 5 (global URL replacement across all columns, not just `media` table), Pitfall 12 (next.config.js image domain update), Pitfall 13 (public bucket — store paths not signed URLs), Pitfall 19 (audit Vercel Blob storage size; upgrade to Supabase Pro if >800 MB before migrating)

### Phase 6: Custom Admin UI

**Rationale:** Depends on all tRPC procedures being in place (Phase 4). The admin UI is the replacement for Payload's `/admin` panel. Uses existing shadcn/ui components; no new libraries required.

**Delivers:** `src/app/(admin)/` route group with role-guarded layout; product list/edit pages; tenant list page; category and tag CRUD; orders read-only view; `adminRouter` tRPC procedures for all admin operations.

**Addresses:** TS-9 (custom admin UI)

**Avoids:** Pitfall 17 (super-admin role check from DB column, not Payload helper)

### Phase 7: Payload Removal + Cutover

**Rationale:** Payload should remain installed and runnable in parallel until every procedure is migrated and verified. Removing Payload last eliminates the risk of a "big bang" cutover with no fallback. This is the final cleanup and production go-live phase.

**Delivers:** All `@payloadcms/*` packages uninstalled from `package.json`; `src/payload.config.ts` deleted; `src/collections/` deleted; `src/app/(payload)/` deleted; `src/lib/access.ts` deleted; `payload-types.ts` deleted; `@payload-config` tsconfig alias removed; `DATABASE_URI` and `PAYLOAD_SECRET` environment variables removed; password reset emails sent to all artists; production cutover executed; `_id_map` table retained for 30 days.

**Addresses:** Full Payload CMS removal, production deployment, D-5 (password reset flow for all migrated users)

**Avoids:** Pitfall 2 (password reset emails sent before cutover, not after), Pitfall 11 (`_id_map` retained for in-flight Stripe sessions), Pitfall 18 (all schema changes via migration files, never dashboard SQL editor)

---

### Phase Ordering Rationale

- **Schema before everything else** — JWT custom claims hook queries `users` and `user_tenants` tables. These must exist before auth is wired up.
- **Auth before procedure migration** — The tRPC context type is the contract all procedures depend on. Changing it first, once, eliminates cascading type errors during the procedure migration.
- **Data migration parallel to auth** — These two phases share no code dependencies. They can be developed simultaneously if team capacity allows.
- **Storage migration after data migration** — `media` table rows must exist in PostgreSQL before their URLs can be updated. Storage must complete before Payload removal.
- **Admin UI after procedures** — Admin UI uses `adminProcedure`, which must be wired before building the UI on top of it.
- **Payload removal last** — Keeps a working fallback until every feature is verified on Supabase. Prevents big-bang cutover risk.

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 1 (Schema + RLS):** The JWT custom claims hook mechanism changed in Supabase Auth (moved from `auth.config` to a database hook). Verify exact hook registration syntax against current Supabase docs before implementation. MEDIUM confidence.
- **Phase 2 (Auth + Middleware):** The `@supabase/ssr` package behavior in Next.js 15.x App Router (specifically cookie handling changes in Next 15 vs 14) needs runtime verification. Research confirms the pattern; specific API surface may have updated. MEDIUM confidence.
- **Phase 3 (Data Migration):** The Supabase `admin.createUser()` API parameter shape for batch user creation without passwords needs verification. Polish-specific Lexical rich text structures may have edge cases not covered by a generic JSON→text converter.
- **Phase 5 (Storage):** Confirm whether Supabase Storage image transforms (Imgproxy) are available on the Free tier or require Pro plan upgrade. This affects whether D-3 (image transforms) is zero-cost or requires plan upgrade.

**Phases with standard patterns (skip research-phase):**

- **Phase 4 (tRPC Procedure Migration):** Mechanical refactor with well-documented Supabase PostgREST query builder. The `ctx.db.find()` → `ctx.supabase.from().select()` mapping is deterministic for each of the 8 routers. No research needed — use the patterns from ARCHITECTURE.md directly.
- **Phase 6 (Admin UI):** Standard shadcn/ui table and form patterns already used in the project. No new technology.
- **Phase 7 (Payload Removal):** Dependency uninstall and file deletion. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `@supabase/supabase-js` v2 and `@supabase/ssr` are stable, well-documented. No-ORM recommendation is sound for this scale. Verify exact patch versions at install time. |
| Features | HIGH | Table stakes derived from direct codebase analysis. Differentiators from well-documented Supabase feature set. Anti-features grounded in project constraints. |
| Architecture | HIGH | RLS patterns, four-client factory, tRPC context shape, and middleware composition are canonical Supabase patterns from official docs. SQL schema is standard relational modelling. |
| Pitfalls | HIGH (critical) / MEDIUM (Supabase-specific) | Pitfalls derived from direct codebase analysis (e.g., `ctx.user.tenants[0]` fragility, Vercel Blob URL distribution, `depth: 2` Payload queries) are HIGH confidence. Supabase SSR cookie pitfalls are MEDIUM — well-known but not web-verified in this session due to tool restrictions. |

**Overall confidence: HIGH**

### Gaps to Address

- **`@supabase/ssr` in Next.js 15 App Router:** `cookies()` API changed between Next.js 14 and 15. Verify that the cookie adapter pattern in `createServerClient` works correctly with Next.js 15's async `cookies()` function before writing any auth code. (See STACK.md Pattern 1.)
- **Supabase Auth custom hook registration:** The mechanism for calling `custom_access_token_hook` was updated in Supabase's auth system. Check current Supabase docs for the correct hook registration method (Supabase dashboard > Auth > Hooks) before implementing JWT custom claims.
- **Supabase Storage image transforms plan tier:** Confirm Pro vs Free tier requirement for Imgproxy transforms before including D-3 in the migration milestone scope.
- **Polish tsvector for full-text search (D-1, deferred):** PostgreSQL's built-in `'simple'` dictionary is sufficient for Polish keyword search but provides no stemming. A `'polish'` dictionary does not ship with standard PostgreSQL. Evaluate `pg_trgm` (trigram similarity) as an alternative for the post-migration milestone.
- **Vercel Blob storage size audit:** Run `curl -s https://api.vercel.com/v6/blob/stores` with the current token to determine total storage used before planning the storage migration. If approaching or exceeding 1 GB, upgrade Supabase plan before attempting migration.

---

## Sources

### Primary (HIGH confidence)
- Current codebase: `src/collections/*.ts`, `src/trpc/init.ts`, `src/modules/auth/server/procedures.ts`, `src/middleware.ts`, `.planning/codebase/ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `STACK.md` — direct source analysis
- `.planning/PROJECT.md` — project requirements and goals
- Supabase SSR Auth + Next.js App Router guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase custom JWT claims / RBAC: https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control-rbac

### Secondary (MEDIUM confidence)
- tRPC context documentation: https://trpc.io/docs/server/context
- Next.js 15 middleware patterns: https://nextjs.org/docs/app/building-your-application/routing/middleware
- `@supabase/ssr` package: https://github.com/supabase/supabase-js/tree/master/packages/ssr
- Supabase Auth Helpers deprecation notice: https://supabase.com/docs/guides/auth/auth-helpers/nextjs

### Note on Research Conditions
External web search and documentation fetch tools were unavailable during the research sessions. All Supabase-specific claims are from training data (knowledge cutoff August 2025) with confidence levels assigned based on source type. Verify `@supabase/ssr` cookie patterns and Auth custom hook registration against current Supabase docs before Phase 1 implementation.

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*

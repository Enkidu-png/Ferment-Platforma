# Domain Pitfalls: Payload CMS + MongoDB to Supabase Migration

**Domain:** Production multi-tenant marketplace migration (MongoDB → PostgreSQL, Payload Auth → Supabase Auth, Vercel Blob → Supabase Storage)
**Researched:** 2026-02-24
**Confidence:** MEDIUM — Sources: project codebase analysis + domain knowledge. External verification blocked; flagged claims noted.

---

## Critical Pitfalls

Mistakes that cause data loss, security breaches, or full rewrites.

---

### Pitfall 1: MongoDB ObjectId Strings Break Everywhere as PostgreSQL Foreign Keys

**What goes wrong:**
MongoDB uses 24-character hex strings (e.g., `507f1f77bcf86cd799439011`) as `_id`. Payload CMS stores these as strings. PostgreSQL foreign keys use UUIDs (`gen_random_uuid()` format: `550e8400-e29b-41d4-a716-446655440000`). If you migrate MongoDB documents into Supabase and keep the hex string as the `id` column — or generate new UUIDs but fail to update every foreign key reference — all relationships break silently.

**Why it happens:**
The migration script creates new UUID-based rows for each collection, but the relational joins between collections still reference the old MongoDB `_id` hex string. For example, a `products` row might get a new UUID `id`, but the `orders` row still has `product_id = "507f1f77bcf86cd799439011"` (a hex string) which matches nothing in PostgreSQL.

**Consequences:**
- Orders orphaned from products
- Products orphaned from tenants (multi-tenancy collapses)
- RLS policies referencing `tenant_id` find no matching rows (all users see nothing, or worse, all users see everything if RLS is bypassed on null)
- Stripe `metadata.productId` in webhooks points to dead IDs — order creation fails silently

**Prevention:**
Build an ID mapping table before migration. Populate it as you insert rows: `{old_mongo_id: string, new_uuid: uuid}`. Run a second pass over every table to rewrite all foreign key columns using this mapping. Never use the MongoDB hex string as the PostgreSQL primary key.

```sql
-- Example mapping table
CREATE TABLE _id_map (
  collection TEXT NOT NULL,
  mongo_id TEXT NOT NULL,
  pg_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (collection, mongo_id)
);
```

**Warning signs:**
- Any query joining two migrated tables returns 0 rows
- Stripe webhook creates orders with `product_id` that doesn't exist in products table
- RLS policies return empty results for authenticated users

**Phase:** Data Migration Script (before any data is moved to production Supabase)

---

### Pitfall 2: Payload Auth Tokens Are Incompatible With Supabase Auth — Sessions Cannot Be Migrated

**What goes wrong:**
Payload CMS uses its own JWT-based auth. Cookies are named `payload-token`. Sessions are verified by calling `ctx.db.auth({ headers })` in every tRPC procedure. Supabase Auth uses entirely different cookies (`sb-[project-ref]-auth-token`), a different JWT secret, and a different verification mechanism. There is no migration path for existing sessions — every logged-in user will be logged out on cutover.

Beyond sessions: Payload stores passwords using its own hashing scheme (bcrypt with Payload-specific salt). Supabase Auth manages passwords internally and does not accept pre-hashed password imports. Users cannot be migrated with their existing passwords.

**Why it happens:**
Teams assume they can `INSERT INTO auth.users` with existing password hashes. Supabase's `auth.users` table is managed by GoTrue (the Supabase Auth service) and rejects direct inserts that bypass its internal password management. Even if raw inserts succeed, the password verification flow will not work because GoTrue uses its own internal bcrypt parameters.

**Consequences:**
- All existing users lose their passwords on cutover — they must reset
- If forced password reset is not implemented before cutover, users cannot log in at all
- Artist accounts locked out = their shops go dark

**Prevention:**
- Accept that password migration is impossible. Plan a mandatory password-reset flow.
- Use Supabase Admin API to create users by email only (no password), then trigger a "set your password" email to each artist before or at cutover
- Use `supabase.auth.admin.createUser({ email, email_confirm: true })` in the migration script — this creates the auth record without requiring password input
- Communicate to all artists: "On [date], you will receive an email to set a new password"

**Warning signs:**
- Any plan that involves copying Payload's `hash` or `salt` fields into Supabase
- Migration script inserting directly into `auth.users` table via raw SQL
- No password-reset email flow planned

**Phase:** Auth Migration (must be planned in roadmap, before go-live cutover)

---

### Pitfall 3: RLS Policies That Forget the Service Role Bypass — tRPC Server Queries Leak All Data

**What goes wrong:**
Supabase has two client modes: the `anon` key (respects RLS) and the `service_role` key (bypasses RLS entirely). When the tRPC server creates a Supabase client using the `service_role` key (which is common for server-side operations), RLS is completely ignored. All tenant data is visible to every query.

**Why it happens:**
Developers use `service_role` key in server-side tRPC procedures for convenience ("I need to write to the DB without auth issues"). This works, but it means every tRPC procedure must manually implement tenant filtering in the `where` clause. There is no safety net. One missing `WHERE tenant_id = $current_tenant` clause exposes all tenants' products/orders to any user.

The existing codebase already has this fragility: `Multi-Tenant Product Query Logic` is listed in CONCERNS.md as fragile because "complex nested where clauses with multiple conditions; easy to introduce permission bypasses."

**Consequences:**
- Products from Artist A visible to Artist B's store
- Orders from Tenant X readable by Tenant Y's admin
- Security audit failure
- Data breach risk if exploited

**Prevention:**
Use a dual-client pattern in tRPC context:
- `anonClient`: created with the user's session token — respects RLS — use for all user-facing reads
- `adminClient`: created with `service_role` — bypasses RLS — use ONLY for admin operations and webhook handlers where you explicitly add tenant filters

Never use `service_role` client for user-facing queries. Write RLS policies as the authoritative security layer and use the `anon` client to prove they work.

```typescript
// tRPC context pattern
const supabaseUser = createClient(url, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${sessionToken}` } }
})
// Use supabaseUser for all user queries — RLS enforces tenant isolation
```

**Warning signs:**
- Every tRPC procedure uses `supabaseAdmin` (service role) client
- RLS policies exist but are never actually tested with a real user session
- The words "I'll add tenant filtering manually" appear in any procedure

**Phase:** Schema Design + RLS Policy Definition (before any procedures are written)

---

### Pitfall 4: RLS Policy Gaps on Junction/Relationship Tables

**What goes wrong:**
RLS policies get written for the main tables (`products`, `orders`, `tenants`) but the junction tables — many-to-many relationships like `product_tags`, `product_categories`, `user_tenants` — get no RLS policies or overly permissive ones. In PostgreSQL, Supabase enables RLS on tables individually. A table with RLS enabled but no policies defaults to DENY ALL for non-service-role access (which is safe but breaks queries). A table with RLS disabled is fully public (which is dangerous).

**Why it happens:**
Schema migration creates many helper/junction tables. RLS policy design focuses on "main" tables. Junction tables are forgotten or given `GRANT SELECT TO authenticated` without tenant scoping.

**Consequences:**
- `user_tenants` table with no RLS: any authenticated user can see which users belong to which tenants
- `product_tags` table exposed: leaks tag associations across tenants
- Queries that JOIN through junction tables silently break because junction table denies access even though the main table allows it

**Prevention:**
For every table created in the schema:
1. Enable RLS (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`)
2. Write at least one SELECT policy
3. Write explicit INSERT/UPDATE/DELETE policies (do not leave these undefined — undefined = denied)
4. Test with a real JWT as an unprivileged user, verify the join returns expected rows

**Warning signs:**
- Junction tables listed in schema without corresponding entries in the RLS policy file
- Any `GRANT ALL TO authenticated` policy (too broad)
- JOINs that work with `service_role` but silently return null with user session

**Phase:** Schema + RLS Design (do this before data migration)

---

### Pitfall 5: Vercel Blob URLs Hardcoded in Database — Storage Migration Order Wrong

**What goes wrong:**
The current codebase stores Vercel Blob URLs directly in the `Media` collection documents (e.g., `https://[hash].public.blob.vercel-storage.com/product-image.jpg`). These URLs are also denormalized into `Products` collection documents as relationship references. If you migrate database data first and storage second, or if you generate new Supabase Storage URLs but miss updating all the places the old URL appears, images will 404 everywhere.

**Why it happens:**
The URL appears in: the `Media` collection document, the `Product` document's media relationship, potentially in serialized rich text fields (if descriptions contain embedded image URLs), and in Stripe product metadata. A migration script that only updates `media.url` misses the denormalized copies.

**Consequences:**
- Product images 404 on live site immediately after cutover
- Artist storefront appears broken even though data migration "succeeded"
- Rich text product descriptions with embedded images show broken image tags

**Prevention:**
- Migrate files to Supabase Storage FIRST, capture the mapping of `old_url → new_url`
- Run a global find-and-replace across ALL text columns in ALL tables using this URL map
- Use PostgreSQL's `UPDATE ... SET column = REPLACE(column, old_url, new_url)` for text fields
- Search for Vercel Blob domain pattern (`blob.vercel-storage.com`) across the database before cutover to find every occurrence
- Check Stripe product metadata separately — Stripe stores data outside Supabase

**Warning signs:**
- Migration script only updates the `media` table and nothing else
- No audit query that searches all text columns for the old storage domain
- Storage migration is planned as the last step

**Phase:** Storage Migration (must happen before DB migration cutover, with URL mapping captured)

---

### Pitfall 6: tRPC Context Refactor Breaks All Procedures If Done Incorrectly

**What goes wrong:**
Every tRPC procedure currently calls `ctx.db.auth({ headers })` to get the current user (where `ctx.db` is the Payload instance). After migration, `ctx.db` is replaced with a Supabase client and `ctx.user` comes from `supabase.auth.getUser()`. If the context shape changes (e.g., `ctx.user` moves from Payload's format to Supabase's format), every single procedure that destructures `ctx.user.id` or `ctx.user.tenants[0].tenant` will throw a runtime error.

The existing pattern (`ctx.user.tenants[0].tenant`) is already flagged as fragile in CONCERNS.md. Supabase does not have a `tenants` array on the user object — that data lives in a `user_tenants` join table.

**Why it happens:**
The refactor touches every tRPC procedure at once (there is no gradual migration path — either Payload handles auth or Supabase does). One incorrect assumption about the new context shape propagates to every procedure.

**Prevention:**
- Define the new `Context` type before touching any procedures
- Make the new context type explicit and narrow:
  ```typescript
  type Context = {
    supabase: SupabaseClient
    user: User | null           // Supabase auth user
    tenantId: string | null     // resolved from user_tenants join
  }
  ```
- Create a `createContext` function that resolves tenant ID from the DB at context creation time, so procedures don't have to
- Update procedures one module at a time, not all at once
- Never use `ctx.db` in new code — make it a TypeScript error

**Warning signs:**
- `ctx.user.tenants` referenced anywhere in new procedure code
- No explicit TypeScript type for the new Context shape
- All procedures updated in one large commit

**Phase:** tRPC Refactor (after Supabase client is set up, before auth is live)

---

### Pitfall 7: Next.js 15 App Router + Supabase SSR Cookie Handling Is Non-Obvious

**What goes wrong:**
Supabase Auth with Next.js 15 App Router requires `@supabase/ssr` package (not `@supabase/supabase-js` directly). The `@supabase/ssr` package needs a specific cookie adapter for Server Components, Route Handlers, and Middleware — and each context needs a different adapter. Using the wrong client in the wrong context causes session to be `null` in Server Components even though the user is authenticated.

Common specific mistake: creating the Supabase client in a Server Component without the cookie adapter, which reads cookies correctly in Middleware but returns an anonymous session in the Server Component.

**Why it happens:**
The `@supabase/supabase-js` README is for client-side usage. Next.js App Router Server Components run on the server and cannot access `document.cookie`. The `@supabase/ssr` package bridges this by reading cookies from Next.js's `cookies()` API. Teams import the wrong package or skip the cookie adapter.

**Consequences:**
- `supabase.auth.getUser()` returns `null` in all Server Components
- SSR pages render as unauthenticated even for logged-in artists
- tRPC server-side prefetch fails to attach user session

**Prevention:**
Follow Supabase's official Next.js guide exactly. Create three helper functions:
- `createServerClient()` — for Server Components and Server Actions (uses `cookies()` from `next/headers`)
- `createRouteHandlerClient()` — for Route Handlers (uses `cookies()` from `next/headers` with read/write)
- `createMiddlewareClient()` — for `middleware.ts` (uses `request`/`response` cookie objects)

Never use `createClient` from `@supabase/supabase-js` in server-side Next.js code.

**Warning signs:**
- `import { createClient } from '@supabase/supabase-js'` in any Server Component or middleware
- `supabase.auth.getSession()` used instead of `supabase.auth.getUser()` (getSession is less secure, susceptible to JWT spoofing)
- Session works in browser console but not in SSR-rendered pages

**Phase:** Supabase Client Setup (very first technical phase, before any auth logic is written)

---

### Pitfall 8: Supabase Middleware Must Refresh Sessions on Every Request or Users Get Logged Out

**What goes wrong:**
Supabase Auth uses short-lived JWTs (typically 1 hour) with refresh tokens. In Next.js 15, the middleware must intercept every request and call `supabase.auth.getUser()` (which triggers a token refresh if needed) and write the updated cookies to the response. If the middleware does not do this, or if the middleware is excluded from too many routes, users get silently logged out after 1 hour.

**Why it happens:**
Teams exclude the middleware from API routes (`/api/*`) to avoid overhead. But if artists are in the admin panel making requests only to `/api/trpc`, and middleware never runs for these paths, refresh tokens never get exchanged, and the session expires.

**Consequences:**
- Artists logged out mid-session with no warning
- In-progress product edits lost
- Confusing "unauthorized" errors that appear randomly after ~1 hour

**Prevention:**
Middleware matcher must include tRPC API routes OR the tRPC route handler must independently refresh the session using `supabase.auth.getUser()` on every request. The simpler approach: run middleware on all routes and let it be a thin session-refresher:

```typescript
// middleware.ts — always refresh, always forward updated cookies
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Warning signs:**
- Middleware matcher excludes `/api/*`
- Middleware only does tenant routing and doesn't touch auth
- `getSession()` called in procedures instead of `getUser()` (doesn't trigger refresh)

**Phase:** Auth + Middleware Setup (must be implemented together)

---

### Pitfall 9: Multi-Tenant Subdomain Middleware Conflicts With Supabase Auth Middleware

**What goes wrong:**
The current middleware (`src/middleware.ts`) already does hostname-based rewriting for subdomain routing. Adding Supabase session refresh to the same middleware is non-trivial: the two concerns must be carefully ordered. If the rewrite happens before the auth cookie refresh, the response object passed to Supabase is the rewritten response, which may not carry cookies correctly back to the client. If auth runs first and rewrites URLs, the tenant routing may break.

**Why it happens:**
Middleware is a single function. Adding Supabase's session refresh pattern (which modifies the Response object) while also doing URL rewrites (which also modifies the Response object) requires careful composition. The naive "paste Supabase auth code into existing middleware" approach produces subtle cookie propagation bugs.

**Consequences:**
- Sessions appear to refresh but cookies are not written to the browser
- Subdomain tenant routing stops working
- Some requests see the auth session, others don't, in unpredictable patterns

**Prevention:**
Structure middleware as an explicit pipeline:
1. Create Supabase client with request/response cookie adapter
2. Call `supabase.auth.getUser()` (refreshes tokens, writes to response)
3. Extract tenant from hostname
4. Apply URL rewrite to the SAME response object that auth already mutated
5. Return the single final response

Never create a new `Response` or `NextResponse` after the Supabase auth step — doing so discards the Set-Cookie headers Supabase wrote.

**Warning signs:**
- `NextResponse.rewrite()` called after `supabase.auth.getUser()` on a separate response object
- Two separate `return NextResponse.rewrite(...)` branches in middleware
- Middleware creates a new `NextResponse` without cloning headers from the Supabase response

**Phase:** Auth + Middleware Setup (implement subdomain routing and auth refresh together, not separately)

---

### Pitfall 10: RLS Policies Using `auth.uid()` Don't Work for Public Storefronts

**What goes wrong:**
A natural first-pass RLS policy for products is:
```sql
CREATE POLICY "users see their tenant products" ON products
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  ));
```
This is correct for authenticated artists managing their own products. But the public storefront (anyone browsing `artist.ferment.com`) is unauthenticated. `auth.uid()` returns `NULL` for unauthenticated visitors. This policy returns zero rows for all storefront visitors — the shop appears empty.

**Why it happens:**
RLS policy design focuses on the authenticated admin use case. Public read access is an afterthought and requires a separate policy that allows anonymous reads for the `anon` role.

**Consequences:**
- Public storefronts show no products — immediate visible breakage
- If the Supabase `anon` key is used in server-side rendering, all SSR product queries return empty
- Only logged-in artists see products (in the wrong context — the admin panel)

**Prevention:**
Every table needs at least two SELECT policies:
1. Public read policy for storefront data (products, categories, tenants) using `anon` role
2. Owner write policies for artists (INSERT/UPDATE/DELETE) using `auth.uid()`

```sql
-- Public can read products for any tenant
CREATE POLICY "public read products" ON products
  FOR SELECT TO anon, authenticated
  USING (true);  -- or: USING (tenant.is_active = true)

-- Only artists can modify their own products
CREATE POLICY "artists manage own products" ON products
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  ));
```

**Warning signs:**
- All SELECT policies contain `auth.uid()` (no anonymous read path)
- Storefront product queries return 0 results in testing with the anon key
- RLS policy testing only done with authenticated sessions

**Phase:** RLS Policy Design (test with both anon and authenticated clients before data migration)

---

### Pitfall 11: Stripe Webhook Handler Uses Dead Product IDs After Migration

**What goes wrong:**
The existing Stripe webhook handler at `src/app/(app)/api/stripe/webhooks/route.ts` looks up products and creates orders using IDs from Stripe's `metadata`. These metadata values were set when Stripe Checkout Sessions were created. The metadata contains MongoDB `_id` hex strings. After migration, Supabase has UUIDs. Old Stripe checkout sessions created before cutover will fire webhooks with MongoDB hex IDs that don't exist in Supabase. Order creation silently fails.

**Why it happens:**
There is a window between "app is migrated to Supabase" and "all in-flight Stripe sessions have expired" where webhooks contain old ID formats. The webhook handler doesn't know which format to expect.

**Consequences:**
- Orders for purchases made just before cutover are never created in Supabase
- Artists don't receive payment notifications
- Buyers receive payment confirmation from Stripe but no order record exists

**Prevention:**
- Add ID format detection in the webhook handler: if `metadata.productId` is a 24-char hex string, look up the ID mapping table to get the new UUID
- Keep the `_id_map` migration table in Supabase for at least 30 days post-cutover
- Log every webhook event with its ID format so you can detect if old-format webhooks are still arriving

```typescript
function resolveProductId(metadataId: string): string {
  if (/^[a-f0-9]{24}$/.test(metadataId)) {
    // MongoDB ObjectId — look up in migration map
    return lookupMigrationMap(metadataId)
  }
  return metadataId // Already a UUID
}
```

**Warning signs:**
- Webhook handler has no awareness of ID format changes
- Migration plan has no "in-flight transaction window" consideration
- `_id_map` table is dropped immediately after migration

**Phase:** Data Migration + Webhook Handler Update (must coordinate timing)

---

## Moderate Pitfalls

### Pitfall 12: Supabase Storage URL Format Differs From Vercel Blob — Next.js Image Domain Config Breaks

**What goes wrong:**
Next.js `next.config.js` has `images.domains` or `images.remotePatterns` configured for Vercel Blob's domain (`*.public.blob.vercel-storage.com`). After migration to Supabase Storage, images are served from `[project-ref].supabase.co/storage/v1/object/public/...`. If `next.config.js` is not updated, `<Image>` components render broken images (Next.js blocks unrecognized domains for security).

**Prevention:**
Update `next.config.js` remote patterns as part of the storage migration phase. Test with `next/image` components specifically, not just raw `<img>` tags.

**Phase:** Storage Migration

---

### Pitfall 13: Supabase Storage Public Buckets vs. Signed URLs for Protected Media

**What goes wrong:**
Supabase Storage has public buckets (no auth required, permanent URLs) and private buckets (requires signed URLs that expire). Product images should be public. But if the bucket is accidentally set to private, all product images require signed URLs that expire — meaning URLs stored in the database become invalid after the expiry period.

**Prevention:**
Create a `public` bucket for product media. Never store signed URLs in the database — only store the path (e.g., `products/filename.jpg`) and construct the public URL at query time using `supabase.storage.from('public').getPublicUrl(path)`.

**Phase:** Storage Setup

---

### Pitfall 14: Row Level Security Performance — N+1 Policy Evaluations

**What goes wrong:**
RLS policies that use subqueries (e.g., `tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())`) run that subquery for every row evaluated. On a table with 10,000 products and a page fetching 50, the policy subquery executes 10,000 times. This causes severe query slowdown that only appears under real data volumes, not during development with small datasets.

**Prevention:**
Use `EXISTS` instead of `IN` for RLS subqueries. Add indexes on `user_tenants(user_id)` and `products(tenant_id)`. Consider using `security definer` functions for complex policy checks:

```sql
CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_products_tenant_id ON products(tenant_id);

-- Prefer EXISTS over IN in policies
CREATE POLICY "artist products" ON products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_tenants.tenant_id = products.tenant_id
      AND user_tenants.user_id = auth.uid()
  ));
```

**Phase:** Schema + RLS Design (add indexes alongside policy creation)

---

### Pitfall 15: Payload's `depth` Parameter Has No Equivalent in Supabase — JOINs Must Be Written Explicitly

**What goes wrong:**
Payload CMS has a `depth` parameter that automatically resolves relationships up to N levels deep. A query with `depth: 2` on Products automatically fetches the related Category, Tenant, and Media documents. In Supabase, there is no equivalent. Every relationship must be explicitly JOINed. Teams underestimate the number of JOIN queries that need to be written.

The existing codebase uses `depth: 2` in at least one checkout procedure (noted in CONCERNS.md as a performance issue). After migration, every place that relied on automatic depth resolution needs an explicit JOIN or a nested Supabase select.

**Prevention:**
Audit every Payload query call for `depth > 0` before migration. For each one, write the equivalent Supabase JOIN. Supabase's PostgREST syntax supports nested selects:

```typescript
const { data } = await supabase
  .from('products')
  .select(`
    *,
    category:categories(*),
    tenant:tenants(*),
    media:product_media(url, alt)
  `)
  .eq('tenant_id', tenantId)
```

**Phase:** tRPC Procedure Refactor

---

### Pitfall 16: Zustand Cart localStorage Keys Not Scoped to Tenant — Persists After Migration

**What goes wrong:**
The existing codebase has a known bug (noted in CONCERNS.md): cart state in localStorage is not scoped to tenant, risking cross-tenant cart collision. After migration, if this is not fixed, users switching between `artist1.ferment.com` and `artist2.ferment.com` may see wrong cart items. This is not a migration issue per se, but the migration is an opportunity to fix it and a missed opportunity becomes a persistent bug.

**Prevention:**
During the tRPC/Zustand refactor phase, scope localStorage keys to tenant slug: `cart-${tenantSlug}` instead of a fixed key.

**Phase:** tRPC Refactor (fix as part of migration, not deferred)

---

## Minor Pitfalls

### Pitfall 17: Payload's `isSuperAdmin()` Helper Has No Direct Supabase Equivalent

**What goes wrong:**
The existing `src/lib/access.ts` `isSuperAdmin()` helper checks Payload's user role system. After migration, super-admin status must be tracked separately — either as a column on the `users` table or as a custom claim in the Supabase JWT via `app_metadata`. If not implemented, the admin UI has no way to restrict access to admin-only operations.

**Prevention:**
Add `role` column to `users` table (`'artist' | 'admin'`). Alternatively, set `app_metadata: { role: 'admin' }` via Supabase Admin API for admin users, then check `user.app_metadata.role === 'admin'` in tRPC procedures. The column approach is simpler and easier to audit.

**Phase:** Schema Design + Auth Migration

---

### Pitfall 18: Supabase Migrations Must Be Version-Controlled — Ad-Hoc SQL Changes Are Irreversible

**What goes wrong:**
Supabase's dashboard allows running SQL directly. Non-programmer owners or AI assistants may fix schema issues directly in the dashboard without creating a migration file. This means the production schema drifts from the codebase, and future deployments or rollbacks don't reproduce the fix.

**Prevention:**
All schema changes go through `supabase/migrations/` SQL files managed by the Supabase CLI. Never use the dashboard SQL editor for schema changes. Run `supabase db diff` before deploying to verify the migration matches expectations.

**Phase:** All phases (ongoing discipline, establish from day one)

---

### Pitfall 19: Supabase Free Tier Storage Limits May Break During File Migration

**What goes wrong:**
Supabase Free tier has a 1 GB storage limit. If the existing Vercel Blob storage holds more than 1 GB of product images, the migration upload will fail partway through without a clear error. The migration script may not handle partial upload failures gracefully.

**Prevention:**
Audit Vercel Blob storage size before migration. If > 800 MB, upgrade to Supabase Pro before attempting migration. Add error handling to the migration script that logs which files failed and allows re-running without re-uploading already-migrated files.

**Phase:** Storage Migration (audit first, migrate second)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Schema design | RLS policies missing on junction tables (Pitfall 4) | Checklist: every table gets RLS enabled + policies |
| RLS policy design | Public storefront returns empty products (Pitfall 10) | Test with anon key + authenticated key separately |
| RLS policy design | N+1 policy evaluation performance (Pitfall 14) | Add indexes alongside every policy |
| Data migration script | ObjectId → UUID foreign key remapping breaks joins (Pitfall 1) | Build `_id_map` table, two-pass migration |
| Storage migration | Vercel Blob URLs not fully replaced across all columns (Pitfall 5) | Global search for `blob.vercel-storage.com` before cutover |
| Storage migration | Next.js image domain config not updated (Pitfall 12) | Update `next.config.js` as part of storage phase |
| Auth migration | Password hashes cannot be imported (Pitfall 2) | Plan forced password reset before cutover |
| Auth migration | Super-admin role lost after migration (Pitfall 17) | Add role column in schema design phase |
| Supabase client setup | Wrong client in SSR context (Pitfall 7) | Use `@supabase/ssr` package throughout |
| Middleware setup | Session expiry after 1 hour (Pitfall 8) | Middleware refreshes session on every request |
| Middleware setup | Auth and subdomain rewrite conflict (Pitfall 9) | Compose as single pipeline on one Response object |
| tRPC refactor | `ctx.user.tenants[0]` breaks (Pitfall 6) | Define new Context type before touching procedures |
| tRPC refactor | Service role bypasses RLS (Pitfall 3) | Use anon client for user queries, admin for writes |
| tRPC refactor | Payload `depth` not auto-resolved (Pitfall 15) | Audit all `depth > 0` calls, write explicit JOINs |
| Webhook handler | In-flight Stripe sessions have MongoDB IDs (Pitfall 11) | ID format detection + keep `_id_map` for 30 days |
| Admin UI | No role-based access control (Pitfall 17) | Implement role check from day one |

---

## Confidence Notes

- **HIGH confidence** (based on direct codebase analysis): Pitfalls 1, 2, 5, 6, 9, 11, 15, 16, 17 — these are derived from specific code patterns in the actual project files
- **MEDIUM confidence** (established Supabase patterns): Pitfalls 3, 4, 7, 8, 10, 12, 13, 14 — well-known Supabase migration concerns, not independently web-verified in this session due to tool restrictions
- **LOW confidence**: None — all pitfalls are either code-derived or widely documented Supabase patterns

External documentation verification was blocked during this research session. Recommended: verify Supabase SSR patterns (Pitfalls 7, 8, 9) against official Supabase Next.js guide before implementation.

---

*Pitfalls research: 2026-02-24*

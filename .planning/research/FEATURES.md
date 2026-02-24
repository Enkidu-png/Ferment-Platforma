# Feature Landscape

**Domain:** Supabase migration for Ferment Platforma (Polish multi-artist marketplace)
**Researched:** 2026-02-24
**Research Mode:** Ecosystem — "What capabilities does migrating to Supabase unlock?"

---

## Context: What Payload CMS Provided

Before cataloguing what Supabase provides, it's worth naming exactly what Payload CMS handled,
because every one of these must be replaced or intentionally dropped:

| Payload Capability | Used For | Migration Fate |
|--------------------|----------|----------------|
| Built-in auth (cookie sessions) | Login, register, protectedProcedure | Replace with Supabase Auth |
| MongoDB collections with schema | All 8 collections | Replace with PostgreSQL tables |
| Access control callbacks per collection | Multi-tenancy, super-admin gates | Replace with RLS policies |
| Multi-tenant plugin | Products/media scoped to tenant | Reimplement with RLS |
| Vercel Blob via @payloadcms/storage-vercel-blob | Media uploads | Replace with Supabase Storage |
| Payload Admin UI at /admin | Content management | Replace with custom admin UI |
| GraphQL API auto-generated | Not used directly by app code | Drop entirely |
| Payload REST API at /api/[...slug] | Not used by app (tRPC used instead) | Drop entirely |
| Rich text editor (lexical) | Product description/content | Replace with plain text/markdown |

---

## Table Stakes

Features that MUST be implemented correctly or the app breaks, regressions occur,
or data is lost. These are not optional.

### TS-1: Supabase Auth — Email/Password Replace Payload Auth

**Why expected:** Every user flow touches authentication. The current `protectedProcedure`
uses `ctx.db.auth({ headers })`. This must be replaced with a Supabase session check.
The register flow creates a Payload user record — this must become a Supabase Auth user
plus a `users` row in PostgreSQL.

**Current Payload implementation:**
- `ctx.db.login()` → issues JWT cookie with Payload's own signing
- `ctx.db.auth({ headers })` → validates that JWT
- Cookie set via `generateAuthCookie()` with `cookiePrefix` from Payload config
- Roles stored in `users.roles` field (select: "super-admin" | "user")

**Supabase replacement:**
- `supabase.auth.signUp({ email, password })` — creates user in Supabase Auth
- `supabase.auth.signInWithPassword({ email, password })` — issues session
- Session stored as `sb-*` cookies by `@supabase/ssr` package
- Session validation in tRPC init via `supabase.auth.getUser()` from cookies
- Custom claims via `user_metadata` or `app_metadata` for role (`super-admin` flag)
- Server-side session reading requires `createServerClient` from `@supabase/ssr`

**Complexity:** Medium. The auth flow itself is straightforward; the tricky part is:
1. Migrating cookie handling in tRPC context (`createTRPCContext`)
2. Propagating `super-admin` role via JWT custom claims (requires Supabase custom claim function or `app_metadata`)
3. Handling the composite registration: user creation + tenant creation + Stripe account creation atomically

**Dependencies:** TS-4 (Users table), TS-5 (Tenants table), TS-8 (tRPC context rewrite)

---

### TS-2: Row Level Security (RLS) — Multi-Tenant Data Isolation

**Why expected:** The current Payload multi-tenant plugin scopes products and media to
tenants. Without equivalent isolation in Supabase, artists could read/modify each other's
data. This is the highest-stakes correctness requirement.

**Current Payload implementation:**
- `@payloadcms/plugin-multi-tenant` adds a `tenants` array field to Users
- Products are scoped by `tenant.slug` equality in where-clauses
- Access control callbacks check `req.user.tenants[0].tenant`
- Super-admin check via `isSuperAdmin()` bypasses tenant scoping

**Supabase replacement pattern:**
- Products table has a `tenant_id` foreign key column
- RLS policy on `products`: `auth.uid() IN (SELECT user_id FROM tenant_members WHERE tenant_id = products.tenant_id)`
- Super-admin bypass: check `auth.jwt()->>'role' = 'super-admin'` or use a service-role key in admin tRPC procedures
- Orders: buyer can read their own orders (`auth.uid() = user_id`), tenant owner can read orders for their products
- Reviews: similar pattern — readable by public, writable only by the purchasing user

**Key design decision:** RLS policies should be the source of truth for authorization,
not application-layer checks. tRPC procedures should use the Supabase client with the
user's JWT (not service-role key) so RLS enforces isolation automatically.

**Complexity:** High. RLS SQL is not TypeScript — mistakes are silent data leaks.
Each table needs policies for SELECT, INSERT, UPDATE, DELETE separately.
The multi-tenant pattern with a `tenant_members` join table is a well-known pattern
but requires careful testing.

**Dependencies:** TS-1 (Auth JWT must flow through to RLS), TS-4 through TS-7 (all tables)

---

### TS-3: Supabase Storage — Replace Vercel Blob

**Why expected:** All existing product images and tenant logos are stored in Vercel Blob
as `https://[hash].public.blob.vercel-storage.com/...` URLs. These URLs are stored in
the Media collection. Post-migration, all files must be in Supabase Storage and all
URLs in the database must point to Supabase Storage CDN.

**Current Payload implementation:**
- `@payloadcms/storage-vercel-blob` stores uploads
- `Media` collection stores `alt` text; actual file URL auto-generated
- `BLOB_READ_WRITE_TOKEN` environment variable controls access
- Products have `image` and `cover` fields; Tenants have `image` field — all relationship to Media

**Supabase replacement:**
- Create a `media` Storage bucket (public, for product images)
- Upload policy: only authenticated users can upload to their own tenant path
- URL pattern: `https://[project-ref].supabase.co/storage/v1/object/public/media/[tenant_slug]/[filename]`
- Migration: script must download each Vercel Blob file and re-upload to Supabase Storage,
  then update the Media table rows with new URLs

**Complexity:** Medium for the upload side; High for the migration script (must handle
all existing files without data loss or broken URLs in the app).

**Storage bucket policy example:**
- Public read for all files in `media/` bucket
- Insert/update: `auth.uid() IN (SELECT user_id FROM tenant_members WHERE tenant_id = storage.foldername(name)[1]::uuid)`
  (uses folder name as tenant scoping)

**Dependencies:** TS-1 (auth), TS-5 (tenants table for scoping paths), data migration script

---

### TS-4: PostgreSQL Table Schema — Users

**Why expected:** User data from MongoDB must land in Supabase PostgreSQL without loss.
The `auth.users` table in Supabase is managed by Auth; the app's `public.users` table
extends it with app-specific fields.

**Current Payload schema fields:**
- `email` (managed by auth)
- `username` (unique, required)
- `roles` (array of "super-admin" | "user")
- `tenants` (array of `{ tenant: id }` — the multi-tenant plugin field)

**Supabase schema:**
```sql
-- public.users (extends auth.users via id FK)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super-admin', 'user'))
);
-- Relationship to tenants is via tenant_members table (see TS-5)
```

**Complexity:** Low schema complexity. Medium migration complexity (must create
Supabase Auth users for each MongoDB user, preserving passwords is impossible —
Payload uses bcrypt, Supabase cannot import hashed passwords from a different system).

**Critical constraint:** Password hashes from Payload/MongoDB CANNOT be imported into
Supabase Auth. Existing users will need password reset emails post-migration, OR the
migration can use Supabase's `admin.createUser()` with a temporary password and force
a password reset on next login.

**Dependencies:** TS-1 (auth), TS-5 (tenant_members join table)

---

### TS-5: PostgreSQL Table Schema — Tenants + Tenant Members

**Why expected:** Tenants (artist shops) are the core multi-tenancy unit. Without the
tenants table and the user-tenant relationship, the subdomain routing and product scoping
cannot function.

**Current Payload schema:**
- `tenants`: name, slug (unique, indexed), image (relationship to media), stripeAccountId, stripeDetailsSubmitted
- User-to-tenant relationship is in `users.tenants` array (the multi-tenant plugin pattern)

**Supabase schema:**
```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT, -- Supabase Storage URL (no separate Media row needed)
  stripe_account_id TEXT NOT NULL,
  stripe_details_submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE (user_id, tenant_id)
);
```

**Complexity:** Low. This is straightforward relational modelling that replaces the
Payload plugin's embedded array approach with a proper join table.

**Dependencies:** TS-4 (users), TS-2 (RLS references tenant_members)

---

### TS-6: PostgreSQL Table Schema — Products, Categories, Tags

**Why expected:** Products are the core browsable content. Categories and tags are
required for the existing filter UI. Without these tables, the homepage and tenant
storefronts break.

**Current Payload schema:**
- `products`: name, description (richText), price (number), category (relationship),
  tags (relationship, hasMany), image (upload), cover (upload), refundPolicy (select),
  content (richText, gated), isPrivate (boolean), isArchived (boolean)
- `categories`: name (and any custom subcategory fields)
- `tags`: name

**Supabase schema:**
```sql
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,         -- was richText, migrate to plain text/markdown
  price NUMERIC(10,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  image_url TEXT,           -- Supabase Storage URL
  cover_url TEXT,           -- Supabase Storage URL
  refund_policy TEXT NOT NULL DEFAULT '30-day',
  content TEXT,             -- gated content, was richText
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_tags (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

**Critical note on richText:** Payload uses Lexical rich text (JSON format). PostgreSQL
stores this as JSONB or migrated to plain markdown. Decision: store as plain text/markdown
in PostgreSQL TEXT column (simpler, sufficient for product descriptions).

**Complexity:** Low for schema. Medium for migration (richText JSON → plain text conversion).

**Dependencies:** TS-5 (products reference tenants), TS-2 (RLS on products)

---

### TS-7: PostgreSQL Table Schema — Orders, Reviews, Media

**Why expected:** Orders are created by Stripe webhooks and must persist. Reviews exist
as a collection (currently admin-only). Media is used to store file metadata.

**Current Payload schema:**
- `orders`: name, user (relationship), product (relationship), stripeCheckoutSessionId, stripeAccountId
- `reviews`: description (textarea), rating (1-5), product (relationship), user (relationship)
- `media`: alt text, file stored in Vercel Blob

**Supabase schema:**
```sql
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  description TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media: with Supabase Storage, a separate media table is optional.
-- Store image_url directly on products/tenants tables (see TS-5, TS-6).
-- A media table is only needed if alt text must be preserved per-file.
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Complexity:** Low. Orders have the most critical correctness requirement (money involved).
The Stripe webhook handler creates orders — it must be updated to use Supabase client
with service-role key (since webhooks have no user JWT).

**Dependencies:** TS-5 (tenant), TS-6 (products), TS-3 (storage for media)

---

### TS-8: tRPC Context Rewrite — Supabase Client Instead of Payload

**Why expected:** Every tRPC procedure currently uses `ctx.db` (the Payload instance).
After migration, `ctx.db` must be replaced with a Supabase client. This is the central
code change that cascades through all 8 routers (auth, tags, tenants, reviews, library,
checkout, products, categories).

**Current pattern:**
```typescript
// src/trpc/init.ts
export const baseProcedure = t.procedure.use(async ({ next }) => {
  const payload = await getPayload({ config });
  return next({ ctx: { db: payload } });
});
```

**Supabase replacement:**
```typescript
// src/trpc/init.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const baseProcedure = t.procedure.use(async ({ next }) => {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: ... } }
  )
  return next({ ctx: { db: supabase } })
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const { data: { user }, error } = await ctx.db.auth.getUser()
  if (error || !user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, session: { user } } })
})
```

**Complexity:** Medium. The pattern change is clear and mechanical. Each procedure
must be rewritten to use PostgreSQL queries via the Supabase client (`ctx.db.from(...)`)
instead of Payload's `ctx.db.find(...)`. This is a large but predictable refactor.

**Dependencies:** TS-1 (Supabase Auth setup), all table schemas (TS-4 through TS-7)

---

### TS-9: Custom Admin UI — Replace Payload Admin Panel

**Why expected:** The project goal explicitly replaces `/admin` with a custom UI. The
Payload Admin at `/admin` will be removed entirely. The non-technical owner needs a
simpler management interface for artists, products, and orders.

**Minimum viable admin UI scope:**
- Dashboard: list tenants, list products, list recent orders
- Product management: create, edit, archive/unarchive, toggle private
- Tenant management: view stripe status, view associated users
- Order viewing: read-only list of all orders (super-admin only)

**What it is NOT:** A full CMS with custom fields, plugins, workflows, or rich text editor.
Simple CRUD forms are sufficient — the owner only needs to manage products and see orders.

**Complexity:** Medium. The UI components (shadcn/ui) are already in the project.
The tRPC procedures will be extended to support admin mutations. Authorization for admin
routes must use the `super-admin` role from Supabase user metadata.

**Dependencies:** TS-1 (auth, role check), TS-8 (tRPC with Supabase), all tables

---

### TS-10: Data Migration Script — MongoDB to Supabase PostgreSQL

**Why expected:** Real artist and product data exists in MongoDB. This data MUST be
preserved — it is not acceptable to lose existing artist profiles, product listings, or
order history. The migration script is not optional.

**Migration scope:**
1. Export all 8 MongoDB collections from Payload
2. Transform: Payload ObjectIDs → UUIDs, richText JSON → plain text
3. Create Supabase Auth users for each existing user (admin API + force password reset)
4. Insert transformed data into PostgreSQL tables in dependency order:
   categories → tags → tenants → users → tenant_members → products → product_tags → orders → reviews
5. Download Vercel Blob files → re-upload to Supabase Storage → update URLs in DB

**Complexity:** High. This is the riskiest phase. Key dangers:
- Password hash incompatibility (Payload bcrypt vs Supabase's managed auth)
- ObjectID vs UUID mismatch in relational references
- richText Lexical JSON may have varied structure depending on what artists typed
- Vercel Blob to Supabase Storage file migration must handle network failures gracefully
- Must be idempotent (safe to run multiple times if interrupted)

**Dependencies:** All table schemas (TS-4 through TS-7), TS-3 (Storage bucket ready)

---

## Differentiators

Capabilities that Supabase enables which Payload CMS did not provide. These are not
migration requirements — they are new features the app can adopt post-migration if
the owner decides to.

### D-1: PostgreSQL Full-Text Search for Products

**What Payload had:** Payload's MongoDB adapter supports basic text matching but no
ranked full-text search. The current product search is filter-only (category, no text search).

**What Supabase enables:** PostgreSQL `tsvector` full-text search with `ts_rank` scoring.
A GIN index on `products.name || ' ' || products.description` enables relevance-ranked
keyword search across all products in a tenant's store.

**Example:**
```sql
CREATE INDEX products_fts_idx ON products
  USING gin(to_tsvector('simple', name || ' ' || coalesce(description, '')));

-- Query:
SELECT * FROM products
WHERE to_tsvector('simple', name || ' ' || coalesce(description, '')) @@ to_tsquery('simple', 'ceramika')
ORDER BY ts_rank(to_tsvector('simple', name || ' ' || coalesce(description, '')), to_tsquery('simple', 'ceramika')) DESC;
```

**Value:** Polish artists can name products in Polish; buyers can find products by keyword.
**Complexity:** Low (index creation + one query change). HIGH confidence (standard PostgreSQL feature).
**Dependencies:** TS-6 (products table must exist)

---

### D-2: Supabase Realtime — Live Order Notifications

**What Payload had:** Nothing. Order creation was fire-and-forget via Stripe webhook.

**What Supabase enables:** Supabase Realtime uses PostgreSQL logical replication to push
row-level changes to subscribed clients via WebSocket. An artist's admin dashboard could
receive instant notifications when a new order is placed for their products.

**Example:** Subscribe to new rows in `orders` where `tenant_id = X` — artist sees
"New order!" without polling.

**Value proposition:** Artists stay on their dashboard and see orders as they arrive.
Reduces "did my product sell?" anxiety without building a separate notification system.

**Complexity:** Medium. Requires enabling Realtime on the `orders` table in Supabase
dashboard and adding a `useEffect` subscription in the admin UI. The tenant-scoping
of the subscription must be validated server-side (RLS applies to Realtime too).

**Confidence:** MEDIUM (Supabase Realtime is well-documented but its behavior with
RLS and JWTs in Next.js App Router needs verification in testing).

**Dependencies:** TS-7 (orders table), TS-2 (RLS ensures artists only see their orders), TS-9 (admin UI)

---

### D-3: Supabase Storage Image Transformations (on-the-fly resize)

**What Payload had:** Payload used `sharp` for image processing at upload time, generating
fixed-size variants. Vercel Blob stored raw files without transformation.

**What Supabase enables:** Supabase Storage has a built-in image transformation API
(via Imgproxy). Any stored image can be resized on-the-fly via URL parameters:
`https://[ref].supabase.co/storage/v1/render/image/public/media/photo.jpg?width=400&quality=80`

**Value:** No need for `sharp` at upload time. Product thumbnails and tenant profile
images can be served at exact dimensions required by the UI, reducing page weight.

**Complexity:** Low. Replace `<img src={product.image_url}>` with a helper that appends
`?width=X&quality=Y` to Supabase Storage URLs. No backend changes.

**Confidence:** MEDIUM (this feature is in Supabase Pro plan; verify plan tier).

**Dependencies:** TS-3 (files must be in Supabase Storage)

---

### D-4: PostgreSQL Generated Columns and Triggers for Audit Trail

**What Payload had:** Payload adds `createdAt` and `updatedAt` automatically to all
collections. MongoDB does not enforce relational integrity.

**What Supabase enables:** PostgreSQL triggers can maintain `updated_at` automatically.
Additionally, a separate `audit_log` table can capture who changed what via triggers —
useful for debugging disputes between artists and the marketplace admin.

**Value:** Non-technical owner can see "this product was modified 3 days ago" in the
admin UI. Useful for resolving "I didn't archive that product" disputes.

**Complexity:** Low for `updated_at` triggers (standard PostgreSQL pattern).
Medium for a full audit log.

**Dependencies:** All table schemas

---

### D-5: Supabase Auth — Password Reset Flow

**What Payload had:** Payload has a password reset flow but it requires custom email
templates and is tightly coupled to Payload's mailer configuration.

**What Supabase enables:** Supabase Auth has a built-in email-based password reset with
configurable templates in the Supabase dashboard. `supabase.auth.resetPasswordForEmail(email)`
sends the email; the app handles the reset form at a redirect URL.

**Value:** This is immediately useful for the migration (all existing users need password
resets since bcrypt hashes cannot be imported). It becomes a permanent feature for
users who forget their passwords.

**Complexity:** Low. Standard Supabase Auth flow.

**Confidence:** HIGH.

**Dependencies:** TS-1 (Supabase Auth setup)

---

### D-6: Supabase Auth — Magic Links / Social OAuth (future)

**What Payload had:** Email/password only (no OAuth providers).

**What Supabase enables:** OAuth providers (Google, GitHub, etc.), magic link login,
OTP via SMS — all configurable in the Supabase dashboard without code changes to
providers once the auth flow is wired up.

**Value:** Future option: "Log in with Google" reduces friction for new artists signing up.

**Complexity:** Low to add once Supabase Auth is wired. Medium to update the registration
flow (artist sign-up creates a Stripe account — this must still happen regardless of OAuth).

**Confidence:** HIGH.

**Dependencies:** TS-1 (Supabase Auth setup). OUT OF SCOPE for migration milestone.

---

## Anti-Features

Things to deliberately NOT implement during this migration. Including these would
increase scope, introduce risk, or contradict the project's goal of a clean migration.

### AF-1: Do NOT Rebuild Payload's Rich Text Editor

**What Payload provides:** The Lexical-based rich text editor for product descriptions
and `content` (gated post-purchase content). Full WYSIWYG with plugins.

**Why to avoid:** The non-technical owner used the Payload admin to write product
descriptions. The custom admin UI replacement should use a simple `<textarea>` or
a lightweight markdown editor (e.g., a `<textarea>` with markdown preview using
`marked` or `remark`). Rebuilding a Lexical or Slate.js editor is weeks of work
with no corresponding business value.

**What to do instead:** Store descriptions as markdown text in PostgreSQL. Render
with a lightweight client-side markdown renderer. Migration: convert existing Lexical
JSON to markdown text during the data migration script.

---

### AF-2: Do NOT Use Supabase Realtime for Cart State

**Why tempting:** Supabase Realtime can sync state across devices in real-time.
The existing cart state bug (not persisted to localStorage, tenant-scoping issue)
might seem like a candidate for Realtime.

**Why to avoid:** Cart state is deliberately ephemeral and client-side in this app.
The Zustand store with localStorage persistence is the right fix for cart state.
A database-backed cart adds latency to every cart interaction and is massively
over-engineered for this marketplace's scale. Fix the localStorage bug in the
existing Zustand store instead.

---

### AF-3: Do NOT Build a Separate API Layer (REST or GraphQL)

**Why tempting:** Payload auto-generated REST and GraphQL APIs. Supabase also
auto-generates a PostgREST API and a GraphQL API (via pg_graphql). These are
tempting to use because they require no code.

**Why to avoid:** The project deliberately uses tRPC for type safety between
Next.js server and client. Switching to PostgREST or Supabase GraphQL would
abandon the existing tRPC investment and the type-safe pattern the codebase is built on.
The tRPC procedures become the query layer — they call Supabase client internally.
PostgREST/GraphQL APIs should remain unused.

---

### AF-4: Do NOT Add New Marketplace Features During Migration

**Why tempting:** Supabase unlocks features Payload didn't have (full-text search,
Realtime, etc.). The migration work exposes all data models — it's tempting to "while
we're here, add X."

**Why to avoid:** The migration scope is already high-risk (password reset for all users,
Vercel Blob → Supabase Storage file migration, Payload code removal). Adding new features
mid-migration multiplies the surface area for bugs and delays delivery.

**Rule:** The migration milestone ends when the app works exactly as it did before,
but on Supabase. New features belong in a subsequent milestone.

---

### AF-5: Do NOT Use Supabase Edge Functions Instead of tRPC

**Why tempting:** Supabase Edge Functions (Deno runtime) can host business logic
closer to the database. The Stripe webhook handler could become a Supabase Edge Function.

**Why to avoid:** The project is deployed on Vercel with Next.js API routes. Moving
the Stripe webhook to a Supabase Edge Function splits the hosting model and complicates
local development. The existing Next.js API route at `/api/stripe/webhooks` is the
correct place for the webhook handler — it should simply replace the Payload DB call
with a Supabase service-role client call.

---

## Feature Dependencies

```
TS-4 (Users schema) → TS-1 (Supabase Auth)
TS-5 (Tenants schema) → TS-4
TS-6 (Products schema) → TS-5
TS-7 (Orders/Reviews schema) → TS-6
TS-2 (RLS) → TS-4, TS-5, TS-6, TS-7 (all tables must exist before RLS policies)
TS-3 (Storage) → TS-5 (tenant slug used as folder path)
TS-8 (tRPC context) → TS-1, TS-2 (auth and RLS must be in place)
TS-9 (Admin UI) → TS-8, TS-1
TS-10 (Data migration) → TS-3, TS-4 through TS-7 (destination schemas must exist)
D-1 (Full-text search) → TS-6
D-2 (Realtime orders) → TS-7, TS-9
D-3 (Image transforms) → TS-3
D-5 (Password reset) → TS-1 (immediate dependency — needed for migration itself)
```

---

## MVP Recommendation

**For the migration milestone, prioritize exactly these table stakes in this order:**

1. **TS-1**: Supabase Auth setup — unblocks everything else
2. **TS-5 + TS-4**: Tenants and Users schema — core identity model
3. **TS-6**: Products, Categories, Tags schema — browsable content
4. **TS-7**: Orders and Reviews schema — transaction records
5. **TS-2**: RLS policies — tenant isolation (implement after schema, test thoroughly)
6. **TS-3**: Supabase Storage bucket + policies — media hosting
7. **TS-8**: tRPC context rewrite + all procedure rewrites — app functionality
8. **TS-10**: Data migration script — preserves real data
9. **TS-9**: Custom admin UI — replaces /admin

**Include from Differentiators during migration (low cost, high value):**
- **D-5**: Password reset flow — required by TS-10 (users cannot import password hashes)
- **D-3**: Image transforms — zero backend cost, pure URL change

**Defer until post-migration milestone:**
- D-1: Full-text search (needs dedicated testing with Polish language tokenisation)
- D-2: Realtime order notifications (nice-to-have, not blocking)
- D-4: Audit log (nice-to-have)
- D-6: OAuth providers (future feature)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Payload capabilities being removed | HIGH | Direct codebase analysis |
| Supabase Auth (email/password, sessions, custom claims) | HIGH | Well-documented, stable API as of training cutoff Aug 2025 |
| Supabase RLS patterns for multi-tenancy | HIGH | Canonical Supabase pattern, well-documented |
| Supabase Storage (buckets, policies, public URLs) | HIGH | Stable feature |
| PostgreSQL schema design | HIGH | Standard relational modelling |
| tRPC + Supabase SSR integration pattern | MEDIUM | Pattern is established but @supabase/ssr in Next.js 15 App Router needs runtime verification |
| Supabase Storage image transforms (Imgproxy) | MEDIUM | Exists but plan-gated; verify on Free vs Pro |
| Supabase Realtime with RLS enforcement | MEDIUM | Feature exists; behavior with complex RLS in App Router needs testing |
| Password hash migration impossibility | HIGH | Bcrypt format incompatibility is a known hard constraint |

---

## Gaps to Address in Phase-Specific Research

- Verify `@supabase/ssr` compatibility with Next.js 15.x App Router (cookie handling changed in Next 15)
- Confirm whether Supabase Storage image transforms are available on Free tier
- Determine the correct approach for Polish text in `tsvector` (use `'simple'` dictionary vs `'polish'` if available)
- Verify Supabase Realtime channel security model with RLS — confirm tenant-scoped subscriptions enforce isolation
- Test `createServerClient` in tRPC context (not standard Next.js middleware — ensure cookies work in tRPC request handler)

---

## Sources

- Codebase analysis: `src/collections/*.ts`, `src/trpc/init.ts`, `src/modules/auth/server/procedures.ts`, `src/middleware.ts` (HIGH confidence — direct source)
- `.planning/codebase/ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `STACK.md` (HIGH confidence — prior codebase audit)
- `.planning/PROJECT.md` (HIGH confidence — project requirements)
- Supabase Auth documentation knowledge (HIGH confidence — stable, well-known API, training cutoff Aug 2025)
- Supabase RLS documentation knowledge (HIGH confidence — canonical PostgreSQL feature)
- NOTE: WebFetch and WebSearch were unavailable in this session — all Supabase-specific claims are from training data (cutoff Aug 2025). Verify against current Supabase docs at https://supabase.com/docs before implementation.

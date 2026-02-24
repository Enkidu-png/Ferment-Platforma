# Phase 1: Foundation - Research

**Researched:** 2026-02-24
**Domain:** Supabase project provisioning — PostgreSQL schema, RLS policies, JWT custom claims, client library setup
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Multi-Tenant Architecture**
- Multi-tenant platform architecture is confirmed: each merchant gets their own shop with separate subdomain
- Tenant isolation enforced at the database layer via RLS (not application-level filtering)
- Every query scoped to a tenant must go through RLS policies

**Merchant Status Design**
- Four statuses: `pending`, `approved`, `rejected`, `suspended`
- Flow: new registration → `pending` → admin approves (→ `approved`) or rejects (→ `rejected`)
- Rejected merchants can reapply: status goes back to `pending`
- Suspended merchants: shop goes invisible, all products hidden from buyers immediately
- Pending merchants CAN set up their shop (add products, configure store) before approval — products stay hidden until approved

**Public Data Visibility (RLS Rules)**
- Browsing is fully public — no account needed to see products or artist shops
- Public (anon access allowed): products from approved merchants, shop profiles of approved merchants
- Private (auth required): orders, user account details, merchant dashboard data
- Only `approved` merchants are visible to the public — `pending` and `suspended` shops are invisible to buyers
- This visibility rule must be enforced at the RLS level (not just UI-level)

**Supabase Environment Setup**
- Single Supabase project (production only) — the app is not yet live, no separate dev project
- Supabase project does not exist yet — plan must include project creation and configuration steps
- Manage everything through the Supabase dashboard (not Supabase CLI) — no migration files, no CLI tooling
- Install `@supabase/supabase-js` and `@supabase/ssr` into the Next.js app in this phase
- Set up four client factory files in `src/lib/supabase/`: server component client, middleware client, client component client, service role client

**Migration Approach**
- App is not currently live — clean migration, no downtime concerns
- Build Supabase completely first, then switch the app over
- Keep Payload CMS accessible during development as a reference for existing schemas and data
- Payload is removed in the final phase (Phase 7)

### Claude's Discretion
- Exact PostgreSQL column types and constraints (within schema requirements)
- RLS policy syntax and implementation details
- File and folder organization within `src/lib/supabase/`

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | Supabase project connected with database, auth, and storage configured in environment | Project creation steps, env var names documented; dashboard-only workflow confirmed |
| FOUN-02 | All 8 PostgreSQL tables created (users, products, categories, tags, tenants, orders, reviews, media) | Full SQL for all 8 tables in Architecture Patterns section; includes new `status` column on tenants |
| FOUN-03 | Row Level Security policies implement tenant isolation (products and media scoped to owning tenant) | Complete RLS SQL for all tables in Architecture Patterns; JWT custom claims provide `tenant_id` |
| FOUN-04 | RLS anonymous-read policies allow unauthenticated buyers to browse products and storefronts | Public-read policies verified; critical: must join tenants table to check `status = 'approved'` |
| FOUN-05 | JWT custom claims hook embeds `tenant_id` and `app_role` into every auth token | Hook function SQL, permissions SQL, and dashboard registration steps fully documented |
| FOUN-06 | Four Supabase client factories created (server component, middleware, client component, service role) | Canonical four-factory pattern from official Supabase docs fully documented with code |
</phase_requirements>

---

## Summary

Phase 1 provisions the complete Supabase infrastructure that every subsequent phase depends on. It has three distinct sub-domains: (1) database schema creation via the Supabase SQL editor — 8 tables with indexes, (2) Row Level Security policy deployment, and (3) Next.js library setup with four client factory files. All work is done through the Supabase dashboard; no CLI, no migration files.

The most critical architectural finding that modifies the pre-existing project research: the existing ARCHITECTURE.md schema for `tenants` does not include a `status` column, but the user's CONTEXT.md requires four merchant statuses (`pending`, `approved`, `rejected`, `suspended`) and mandates that public visibility of products and shop profiles is gated on `status = 'approved'` at the RLS level. The `tenants` table schema must be augmented with a `status` column, and the products public-read RLS policy must join against `tenants.status` — not just check `is_archived` and `is_private`. This is a schema gap that would cause silent correctness failure if missed.

The JWT custom claims hook registration in the Supabase dashboard is now confirmed (verified against current official docs): navigate to Authentication > Hooks, select the Postgres function from the dropdown. The required permission grants to `supabase_auth_admin` are mandatory and must be run as SQL before hook activation. Type generation can be done via the dashboard download at `/dashboard/project/_/api?page=tables-intro` without the CLI, which aligns with the dashboard-only workflow constraint.

**Primary recommendation:** Write all schema SQL in a single ordered script (tables first, functions second, RLS policies third, hook registration last) and run it in the Supabase SQL editor. The order matters because the hook function queries `users` and `user_tenants` tables that must already exist.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.97.0` | Universal client: database queries, auth, storage | Single SDK for all Supabase services; replaces all Payload CMS data access |
| `@supabase/ssr` | `^0.8.0` | Cookie-based session management for Next.js App Router | Official replacement for deprecated `@supabase/auth-helpers-nextjs`; required for server-side session handling |

### Not Needed in This Phase

| Package | Why Not |
|---------|---------|
| `@supabase/auth-helpers-nextjs` | Deprecated by Supabase; do not install |
| `@supabase/auth-ui-react` | App has custom auth forms; pre-built UI not appropriate |
| `supabase` (CLI package) | Workflow is dashboard-only; no CLI usage |
| Drizzle, Prisma | ORM explicitly rejected; Supabase query builder is sufficient |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Environment Variables

**Add to `.env` (and Vercel dashboard):**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-from-dashboard]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key-from-dashboard]
```

**Do NOT add yet** (existing vars stay in place while Payload is still running):
```
# DATABASE_URI — keep for now (Payload still running)
# PAYLOAD_SECRET — keep for now
```

---

## Architecture Patterns

### Recommended File Structure

```
src/lib/supabase/
├── server.ts      # Server Components + Route Handlers (cookie client)
├── middleware.ts  # Next.js middleware (cookie client with response mutation)
├── client.ts      # Browser Client Components only
└── admin.ts       # Service role client (server-only, bypasses RLS)
```

### Pattern 1: Complete PostgreSQL Schema (All 8 Tables)

Run this SQL in the Supabase SQL editor in this exact order. Dependencies: `media` before `tenants`, `tenants` before `products` and `user_tenants`, `users` before everything user-referencing.

**CRITICAL SCHEMA CHANGE vs. pre-existing ARCHITECTURE.md:**
The `tenants` table in ARCHITECTURE.md does not have a `status` column. The CONTEXT.md requires four merchant statuses enforced at RLS level. The corrected schema below includes this column.

```sql
-- ─── MEDIA (no FKs; referenced by tenants and products) ──────────────────────
create table media (
  id           uuid primary key default gen_random_uuid(),
  alt          text not null,
  url          text not null,           -- Supabase Storage public URL
  storage_path text not null,           -- path within the storage bucket
  width        integer,
  height       integer,
  mime_type    text,
  created_at   timestamptz not null default now()
);

-- ─── TENANTS ──────────────────────────────────────────────────────────────────
create table tenants (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  slug                     text not null unique,
  status                   text not null default 'pending'
                           check (status in ('pending', 'approved', 'rejected', 'suspended')),
  stripe_account_id        text not null unique,
  stripe_details_submitted boolean not null default false,
  image_id                 uuid references media(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index on tenants(slug);
create index on tenants(status);   -- RLS policies filter by status on every public read

-- ─── USERS (extends auth.users) ───────────────────────────────────────────────
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        text not null default 'user' check (role in ('user', 'super-admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── USER_TENANTS (replaces Payload tenantsArrayField) ────────────────────────
create table user_tenants (
  user_id   uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary key (user_id, tenant_id)
);
create index on user_tenants(user_id);
create index on user_tenants(tenant_id);

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  color      text,
  parent_id  uuid references categories(id),
  created_at timestamptz not null default now()
);
create index on categories(parent_id);

-- ─── TAGS ─────────────────────────────────────────────────────────────────────
create table tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────
create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10,2) not null,
  category_id   uuid references categories(id),
  image_id      uuid references media(id),
  cover_id      uuid references media(id),
  refund_policy text not null default '30-day'
                check (refund_policy in ('30-day','14-day','7-day','3-day','1-day','no-refunds')),
  content       text,
  is_private    boolean not null default false,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on products(tenant_id);
create index on products(category_id);
create index on products(is_archived, is_private);
create index on products(tenant_id, is_archived, is_private);  -- optimizes public read + tenant filter

-- ─── PRODUCT_TAGS (many-to-many) ──────────────────────────────────────────────
create table product_tags (
  product_id uuid not null references products(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────
create table orders (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references users(id),
  product_id                 uuid not null references products(id),
  stripe_checkout_session_id text not null unique,
  stripe_account_id          text,
  created_at                 timestamptz not null default now()
);
create index on orders(user_id);
create index on orders(product_id);

-- ─── REVIEWS ──────────────────────────────────────────────────────────────────
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  user_id     uuid not null references users(id),
  description text not null,
  rating      smallint not null check (rating between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
```

### Pattern 2: JWT Custom Claims Hook

Run this SQL after the tables are created (hook function queries `users` and `user_tenants`).

**Step 1 — Create the hook function:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims        jsonb;
  user_tenant_id uuid;
  user_role     text;
begin
  -- Fetch tenant membership (null for buyers who have no tenant)
  select ut.tenant_id into user_tenant_id
  from public.user_tenants ut
  where ut.user_id = (event->>'user_id')::uuid
  limit 1;

  -- Fetch app role from users table
  select u.role into user_role
  from public.users u
  where u.id = (event->>'user_id')::uuid;

  -- Embed claims into the JWT
  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
  claims := jsonb_set(claims, '{app_role}',  to_jsonb(coalesce(user_role, 'user')));

  return jsonb_set(event, '{claims}', claims);
end;
$$;
```

**Step 2 — Grant required permissions:**
```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant all on table public.user_tenants to supabase_auth_admin;
grant all on table public.users to supabase_auth_admin;

-- Lock it down from public roles
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

**Step 3 — Register in the Supabase dashboard:**
Navigate to: **Authentication > Hooks** → select "Custom Access Token" hook type → choose `public.custom_access_token_hook` from the Postgres function dropdown → save.

### Pattern 3: Helper Functions for RLS Policies

Create these before writing the policies (they are used inside policy expressions):

```sql
-- Returns the current user's tenant_id from their JWT (zero extra query)
create or replace function auth.tenant_id() returns uuid language sql stable as $$
  select coalesce(
    nullif((auth.jwt() ->> 'tenant_id'), 'null')::uuid,
    null
  )
$$;

-- Returns true if the current user is a super-admin
create or replace function auth.is_super_admin() returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'app_role') = 'super-admin',
    false
  )
$$;
```

**Note:** Use `nullif((auth.jwt() ->> 'tenant_id'), 'null')::uuid` rather than `(auth.jwt() -> 'tenant_id')::text::uuid` — the former correctly handles the case where `tenant_id` is JSON `null` (buyers have no tenant).

### Pattern 4: RLS Policies — Complete Set

Enable RLS on all tables first:
```sql
alter table tenants      enable row level security;
alter table users        enable row level security;
alter table user_tenants enable row level security;
alter table products     enable row level security;
alter table product_tags enable row level security;
alter table categories   enable row level security;
alter table tags         enable row level security;
alter table orders       enable row level security;
alter table reviews      enable row level security;
alter table media        enable row level security;
```

**Tenants table — CRITICAL: public read only for approved tenants:**
```sql
-- Anon can see approved tenants only (powers public storefront listing)
create policy "tenants: anon read approved"
  on tenants for select
  using (status = 'approved');

-- Authenticated tenant owner can see their own tenant (even if pending/suspended)
create policy "tenants: owner read own"
  on tenants for select
  using (id = auth.tenant_id());

-- Super-admin sees all tenants
create policy "tenants: super-admin all"
  on tenants for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Products table — CRITICAL: public read joins tenant status:**
```sql
-- Anon can read products only if: not archived, not private, AND tenant is approved
-- Uses a subquery to check tenant status (RLS enforced in the DB, not in app code)
create policy "products: anon read approved-tenant"
  on products for select
  using (
    is_archived = false
    and is_private = false
    and exists (
      select 1 from tenants t
      where t.id = products.tenant_id
      and t.status = 'approved'
    )
  );

-- Tenant owner sees all their own products (including private, archived, pending-approval)
create policy "products: owner read all"
  on products for select
  using (tenant_id = auth.tenant_id());

-- Tenant owner can insert their own products
create policy "products: owner insert"
  on products for insert
  with check (tenant_id = auth.tenant_id());

-- Tenant owner can update their own products
create policy "products: owner update"
  on products for update
  using (tenant_id = auth.tenant_id())
  with check (tenant_id = auth.tenant_id());

-- Tenant owner can delete their own products
create policy "products: owner delete"
  on products for delete
  using (tenant_id = auth.tenant_id());

-- Super-admin full access
create policy "products: super-admin all"
  on products for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Users table:**
```sql
-- Users can read their own profile
create policy "users: read own"
  on users for select
  using (id = auth.uid());

-- Users can update their own profile
create policy "users: update own"
  on users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Super-admin full access
create policy "users: super-admin all"
  on users for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**User_tenants junction table:**
```sql
-- Users can read their own tenant memberships
create policy "user_tenants: read own"
  on user_tenants for select
  using (user_id = auth.uid());

-- Super-admin full access
create policy "user_tenants: super-admin all"
  on user_tenants for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Product_tags junction table:**
```sql
-- Public read (tags are visible if the product is visible — RLS on products governs access indirectly)
-- Products RLS handles visibility; product_tags are supplementary metadata
create policy "product_tags: public read"
  on product_tags for select using (true);

-- Tenant owner can manage tags for their products
create policy "product_tags: owner write"
  on product_tags for all
  using (
    exists (
      select 1 from products p
      where p.id = product_tags.product_id
      and p.tenant_id = auth.tenant_id()
    )
  )
  with check (
    exists (
      select 1 from products p
      where p.id = product_tags.product_id
      and p.tenant_id = auth.tenant_id()
    )
  );

-- Super-admin full access
create policy "product_tags: super-admin all"
  on product_tags for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Orders table:**
```sql
-- Users see only their own orders
create policy "orders: user read own"
  on orders for select
  using (user_id = auth.uid());

-- Super-admin sees all orders
create policy "orders: super-admin all"
  on orders for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());

-- Note: order INSERT is done by the Stripe webhook via the service-role client (bypasses RLS).
-- No INSERT policy needed for the anon/user role.
```

**Reviews table:**
```sql
-- Anyone can read reviews
create policy "reviews: public read"
  on reviews for select using (true);

-- Authenticated users can create reviews (purchase check in tRPC, not RLS)
create policy "reviews: authenticated insert"
  on reviews for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Users can update their own reviews
create policy "reviews: owner update"
  on reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own reviews
create policy "reviews: owner delete"
  on reviews for delete
  using (user_id = auth.uid());
```

**Categories and Tags (global, admin-managed):**
```sql
create policy "categories: public read" on categories for select using (true);
create policy "tags: public read"       on tags       for select using (true);

create policy "categories: super-admin write"
  on categories for all
  using (auth.is_super_admin()) with check (auth.is_super_admin());

create policy "tags: super-admin write"
  on tags for all
  using (auth.is_super_admin()) with check (auth.is_super_admin());
```

**Media table:**
```sql
-- Public read (media is referenced by publicly-visible products and tenants)
create policy "media: public read" on media for select using (true);

-- Authenticated users can upload media (tenant association handled in tRPC procedure)
create policy "media: authenticated insert"
  on media for insert with check (auth.uid() is not null);

-- Super-admin can delete media
create policy "media: super-admin delete"
  on media for delete using (auth.is_super_admin());
```

### Pattern 5: Four Supabase Client Factory Files

**`src/lib/supabase/server.ts`** — Server Components, Route Handlers, Server Actions:
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component calling set() — ignored; middleware handles refresh
          }
        },
      },
    }
  )
}
```

**`src/lib/supabase/middleware.ts`** — Called from `src/middleware.ts` for session refresh:
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST call getUser() not getSession() — validates JWT server-side
  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

**`src/lib/supabase/client.ts`** — Browser Client Components only:
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/supabase/admin.ts`** — Service role (bypasses RLS), server-only:
```typescript
import { createClient } from '@supabase/supabase-js'
import 'server-only'
import type { Database } from './types'

// Singleton — do not call createClient() in a request handler; use this module-level instance
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

### Pattern 6: TypeScript Type Generation (No CLI)

Since the workflow is dashboard-only (no CLI), generate types via the Supabase dashboard:
1. Navigate to: `https://supabase.com/dashboard/project/[project-ref]/api?page=tables-intro`
2. Click "Generate and download types"
3. Save the downloaded file as `src/lib/supabase/types.ts`
4. Alternatively: use the Management API endpoint documented at https://supabase.com/docs/reference/api/v1-generate-typescript-types

**Placeholder for types.ts during development (before full schema is built):**
```typescript
// src/lib/supabase/types.ts — replace with generated types after schema is created
export type Database = {
  public: {
    Tables: {
      // generated types will go here
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
```

### Anti-Patterns to Avoid

- **`getSession()` in middleware:** Reads cookie without contacting Supabase servers — a tampered cookie can spoof authentication. Always use `getUser()` in middleware.
- **Service role key in client-side code:** `SUPABASE_SERVICE_ROLE_KEY` must never appear in `NEXT_PUBLIC_*` env vars or be imported in Client Components. It bypasses all RLS.
- **RLS on only one operation type:** A table with `SELECT` policy but no `INSERT`/`UPDATE` policy silently blocks writes. Check every operation (SELECT, INSERT, UPDATE, DELETE) for every table.
- **Separate response object for subdomain rewrite:** Creating a new `NextResponse.rewrite()` after the Supabase session refresh discards the refreshed session cookies. Use the pattern in Pattern 5 (middleware.ts) that copies cookies onto the rewrite response.
- **Missing `status` check in products public-read policy:** The products public-read policy must check the tenant's `status = 'approved'`, not just `is_archived = false`. If the tenant status check is omitted, products from `suspended` or `pending` merchants will be visible to the public.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management in Next.js | Custom cookie serialization/deserialization | `@supabase/ssr` `createServerClient` | Handles cookie expiry, refresh, and HttpOnly flags correctly across all Next.js contexts |
| JWT token refresh | Manual refresh logic in middleware | `supabase.auth.getUser()` in middleware | Supabase automatically rotates tokens silently; `getUser()` triggers this |
| RLS tenant isolation | Application-level `WHERE tenant_id = $x` filters | Postgres RLS policies with `auth.tenant_id()` | DB-level enforcement is secure even if application code is wrong; application filters are defense-in-depth only |
| Type safety for DB queries | Manual interface definitions | `supabase gen types` output + `createClient<Database>()` | Generated types are always in sync with actual schema; manual interfaces drift |
| Admin bypass of RLS | Custom `pg_bypass_rls` logic | Service role key + `supabaseAdmin` singleton | The service role bypasses RLS by design; no custom code needed |

**Key insight:** The `@supabase/ssr` package handles the hardest part of the entire phase — session cookies across Server Components, middleware, and Route Handlers in Next.js App Router. Do not attempt to manage Supabase cookies manually.

---

## Common Pitfalls

### Pitfall 1: Missing `status` column on `tenants` table

**What goes wrong:** The pre-existing ARCHITECTURE.md schema for `tenants` does not include a `status` column. If the planner copies that schema verbatim, merchant approval/rejection/suspension functionality has no data model and the public visibility RLS cannot be implemented.

**Why it happens:** The schema was designed before the merchant status requirement was formally locked in CONTEXT.md.

**How to avoid:** Use the corrected schema in this research document (Pattern 1) which includes `status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended'))` on the `tenants` table and an index on `tenants(status)`.

**Warning signs:** A products public-read RLS policy that does not reference the `tenants` table is a red flag that the status check was omitted.

### Pitfall 2: Products Public RLS Misses Tenant Status Check

**What goes wrong:** Products from `pending` or `suspended` merchants become publicly visible to anonymous buyers.

**Why it happens:** Writing the products public-read policy as `is_archived = false AND is_private = false` without joining `tenants.status = 'approved'` — which is the pattern in the pre-existing ARCHITECTURE.md.

**How to avoid:** The public-read policy on `products` must include a subquery checking `tenants.status = 'approved'` (see Pattern 4 above).

**Warning signs:** A newly-created merchant's products appearing on the public storefront before admin approval.

### Pitfall 3: Hook Function Runs Before Tables Exist

**What goes wrong:** Deploying the `custom_access_token_hook` function before `users` and `user_tenants` tables exist. The hook function will fail at runtime when a user logs in, breaking authentication.

**Why it happens:** Running SQL statements out of order in the editor.

**How to avoid:** Strict SQL execution order: tables → helper functions → RLS policies → hook function → hook permissions → hook dashboard registration.

**Warning signs:** Login attempts returning 500 errors immediately after hook registration.

### Pitfall 4: `auth.tenant_id()` Returns Wrong Value for Buyers

**What goes wrong:** Buyers who have no tenant membership get a `null`-typed value that doesn't cast correctly to `uuid`, causing RLS policy expressions to throw exceptions instead of returning false.

**Why it happens:** Writing `(auth.jwt() -> 'tenant_id')::text::uuid` — when the JWT contains JSON `null` for `tenant_id`, the cast to `uuid` throws an error.

**How to avoid:** Use `nullif((auth.jwt() ->> 'tenant_id'), 'null')::uuid` — `nullif` with the string `'null'` handles JSON null serialized as the string `"null"` gracefully.

**Warning signs:** Unauthenticated product browsing works but authenticated buyer browsing throws PostgreSQL errors.

### Pitfall 5: Missing Permission Grants for Hook Function

**What goes wrong:** Hook is registered in the dashboard but silently fails on login. The hook function cannot read `users` or `user_tenants` tables because `supabase_auth_admin` has no access.

**Why it happens:** Only creating the function without running the `GRANT` statements.

**How to avoid:** Run all four grant statements in Pattern 2 Step 2 before registering the hook. Test by logging in as a new user and checking the JWT via `supabase.auth.getSession()`.

**Warning signs:** JWT tokens contain no `tenant_id` or `app_role` claims after hook registration; RLS policies that reference `auth.tenant_id()` return incorrect results.

### Pitfall 6: `product_tags` Junction Table Has No RLS Policy

**What goes wrong:** The junction table blocks all reads (RLS active, no SELECT policy = zero rows returned), making tags invisible on all products.

**Why it happens:** Forgetting to add policies to junction tables — they are easy to overlook because they have no "owner" in the traditional sense.

**How to avoid:** All 10 tables must have `enable row level security` called AND at least one SELECT policy. Check the full list in Pattern 4 and count 10 tables.

**Warning signs:** Product detail pages show zero tags despite tags being set.

### Pitfall 7: Service Role Key Exposed in Next.js

**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` appears in a `NEXT_PUBLIC_` environment variable, making it accessible in the browser and bypassing all RLS for any user.

**Why it happens:** Copying the anon key pattern without noticing the `NEXT_PUBLIC_` prefix is public-facing.

**How to avoid:** `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) is server-only. Import it only in `src/lib/supabase/admin.ts` which imports `server-only`. Never in Client Components.

**Warning signs:** The service role key appearing in the browser's Network tab responses or in the compiled JavaScript bundle.

---

## Code Examples

### Supabase Project Creation Sequence (Dashboard Steps)

Run in the Supabase dashboard — these are manual steps, not code:

1. Go to https://supabase.com/dashboard → New project
2. Set project name, database password, region (choose EU for Polish compliance)
3. Wait for provisioning (~2 minutes)
4. Go to Settings > API → Copy `Project URL` and `anon public` key → add to `.env` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Go to Settings > API → Copy `service_role` key → add to `.env` as `SUPABASE_SERVICE_ROLE_KEY`
6. Go to Database > SQL Editor → run the schema SQL from Pattern 1
7. Run helper functions from Pattern 3
8. Enable RLS and run all policies from Pattern 4
9. Run hook function and grants from Pattern 2
10. Go to Authentication > Hooks → register the hook
11. Download TypeScript types from API > Tables → save as `src/lib/supabase/types.ts`

### Verifying RLS Works (Test Queries)

Run these in the SQL editor to validate policies before writing any application code:

```sql
-- Test anon can see approved-tenant products (should return rows if any exist)
set role anon;
select id, name, tenant_id from products limit 5;

-- Test anon cannot see products from non-approved tenants
-- (create a test tenant with status='pending', add a product, confirm it's invisible to anon)

-- Test authenticated user sees only their own orders
set role authenticated;
set request.jwt.claim.sub = '[some-user-uuid]';
select * from orders;  -- should only return rows where user_id = the uuid above

-- Reset role
reset role;
```

### Verifying JWT Claims After Hook Registration

```typescript
// In a Next.js Server Component or API route — test after logging in
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  // Decode and inspect the JWT payload
  const payload = JSON.parse(atob(session.access_token.split('.')[1]))
  console.log('tenant_id:', payload.tenant_id)   // should be UUID or null
  console.log('app_role:', payload.app_role)     // should be 'user' or 'super-admin'
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | auth-helpers is deprecated and does not support Next.js 15 async `cookies()`; must use `@supabase/ssr` |
| `auth.config` hook configuration (Supabase pre-2024) | Database Hooks via dashboard (Authentication > Hooks) | The old `auth.config` approach is no longer how hooks are registered; use the dashboard |
| `getSession()` for auth checks | `getUser()` for auth checks | `getSession()` is insecure in server context; Supabase security model requires `getUser()` in middleware |
| Application-layer tenant filtering (Payload multi-tenant plugin) | PostgreSQL RLS policies | RLS moves isolation to the DB engine; missed JS filters can no longer cause data leaks |

**Deprecated / outdated:**
- `@supabase/auth-helpers-nextjs`: Do not install. Deprecated by Supabase; all fixes go to `@supabase/ssr`.
- `createClient` from `@supabase/supabase-js` in server/middleware context: Use `createServerClient` from `@supabase/ssr` instead for all server-side usage.

---

## Open Questions

1. **`auth.tenant_id()` helper function schema placement**
   - What we know: Helper functions that call `auth.jwt()` must be placed in a schema where `supabase_auth_admin` has access
   - What's unclear: Whether placing `auth.tenant_id()` in the `auth` schema (vs `public`) requires additional grants
   - Recommendation: Place in `public` schema with explicit name `public.get_tenant_id()` to avoid ambiguity, then alias it in policies. The ARCHITECTURE.md places it in `auth` schema — verify this works with a test login before deploying all policies.

2. **Merchant status visibility enforcement — suspended vs. pending**
   - What we know: Both `pending` and `suspended` tenants must be invisible to anonymous buyers
   - What's unclear: Whether a `suspended` merchant can still log into their dashboard and manage products (the status flow described in CONTEXT.md suggests yes — they just become invisible to buyers)
   - Recommendation: Planner should confirm: the "owner read all" policy on `products` grants tenant owners full access regardless of their `status`. This means a suspended merchant can still access their dashboard. That is the correct interpretation of the CONTEXT.md requirement.

3. **TypeScript types placeholder before schema is created**
   - What we know: Client factories require `<Database>` generic type parameter; types come from schema generation
   - What's unclear: Exact timing — client files must be created in this phase but types cannot be generated until schema exists
   - Recommendation: Create a minimal `types.ts` placeholder first, create client files using it, then replace with generated types after schema is built. The planner should sequence: schema → type download → client files.

---

## Sources

### Primary (HIGH confidence)
- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook — hook function signature, required permissions, dashboard registration
- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac — full SQL example for adding custom claims
- https://supabase.com/docs/guides/auth/auth-hooks — hook registration process, permission grants
- https://supabase.com/docs/guides/auth/server-side/nextjs — canonical four-factory pattern for Next.js App Router
- https://supabase.com/docs/guides/api/rest/generating-types — dashboard type generation (no CLI)
- `.planning/research/ARCHITECTURE.md` — full schema (adapted; `status` column added for this phase)
- `.planning/research/STACK.md` — package versions and client factory patterns
- `src/collections/Tenants.ts` — confirmed existing schema has no `status` field (direct codebase read)
- npm registry (live): `@supabase/supabase-js@2.97.0`, `@supabase/ssr@0.8.0`

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — project research flags; confirmed Phase 1 needs deep research into hook syntax
- WebSearch: Supabase Auth custom access token hook 2025 — confirmed dashboard registration path is "Authentication > Hooks"

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages + versions): HIGH — verified via npm registry live query
- Schema SQL: HIGH — adapted from ARCHITECTURE.md with confirmed `status` column addition
- JWT hook syntax: HIGH — verified against current official Supabase docs via WebFetch
- Hook registration (dashboard steps): HIGH — confirmed via official docs and WebSearch
- RLS policies: HIGH — derived from official RLS docs patterns; tenant-status check is new but logically sound
- Client factory patterns: HIGH — confirmed canonical pattern from official Supabase Next.js guide
- `auth.tenant_id()` schema placement: MEDIUM — placement in `auth` schema unconfirmed; needs runtime test

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (Supabase packages update frequently; verify patch versions at install time)

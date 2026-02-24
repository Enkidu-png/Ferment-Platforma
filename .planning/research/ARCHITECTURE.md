# Architecture Patterns

**Domain:** Multi-tenant marketplace (Supabase migration from Payload CMS + MongoDB)
**Researched:** 2026-02-24
**Confidence:** HIGH (patterns derived from official Supabase docs architecture, verified against current codebase)

---

## Recommended Architecture

The post-migration system keeps the same layered structure but replaces the Payload CMS data layer with Supabase. The tenant-isolation responsibility moves from the application layer (Payload multi-tenant plugin + JS filters) to the database layer (Postgres RLS policies). This is a significant improvement: instead of every query needing manual tenant filtering, the database enforces isolation by default.

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  React Query + Zustand (unchanged)                  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────┐
│  Next.js 15 App Router                              │
│  ├── middleware.ts  ← tenant routing + session      │
│  ├── (app)/        ← public marketplace             │
│  ├── (tenants)/    ← artist storefronts             │
│  ├── (auth)/       ← login / register pages         │
│  └── (admin)/      ← custom admin UI (new)          │
└────────────────────┬────────────────────────────────┘
                     │ tRPC procedure calls
┌────────────────────▼────────────────────────────────┐
│  tRPC Layer  (src/trpc/)                            │
│  ├── context: { supabase, user, tenantId }          │
│  ├── baseProcedure    (public, anon client)         │
│  └── protectedProcedure (authed service client)     │
└────────────────────┬────────────────────────────────┘
                     │ supabase-js queries
┌────────────────────▼────────────────────────────────┐
│  Supabase                                           │
│  ├── PostgreSQL (RLS enforces tenant isolation)     │
│  ├── Auth (sessions, JWT with custom claims)        │
│  └── Storage (product images, tenant avatars)       │
└─────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/middleware.ts` | Extract tenant slug from hostname, refresh Supabase session cookie, rewrite URL | Next.js runtime, Supabase Auth |
| `src/trpc/init.ts` | Build tRPC context with Supabase client + authenticated user | All tRPC procedures |
| `src/lib/supabase/server.ts` | Create server-side Supabase client (cookie-based) | tRPC init, Server Components, admin procedures |
| `src/lib/supabase/client.ts` | Create browser Supabase client | Client components only (avoid — prefer tRPC) |
| `src/modules/*/server/procedures.ts` | Business logic, calls Supabase directly | tRPC context, Stripe SDK |
| `src/app/(admin)/` | Custom admin UI — CRUD for all tables, visible only to super-admin | tRPC adminRouter procedures |
| Supabase RLS policies | Enforce tenant isolation at database level | PostgreSQL query engine |

---

## PostgreSQL Schema Design

### Mapping from MongoDB Collections to Postgres Tables

All 8 Payload collections become Postgres tables. MongoDB `_id` strings become `uuid` primary keys. Relationships become foreign keys. Payload's `tenantsArrayField` (users → tenants join array) becomes a normalized `user_tenants` junction table.

```sql
-- ─── TENANTS ──────────────────────────────────────────────────────────────────
create table tenants (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,             -- subdomain identifier
  stripe_account_id       text not null unique,
  stripe_details_submitted boolean not null default false,
  image_id                uuid references media(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on tenants(slug);    -- hot path: every tenant-scoped request

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- auth.users is managed by Supabase Auth.
-- This table extends it with app-specific fields.
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        text not null default 'user' check (role in ('user', 'super-admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── USER_TENANTS (replaces Payload tenantsArrayField) ────────────────────────
-- Each user can own at most one tenant in practice, but the schema allows many.
create table user_tenants (
  user_id   uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary key (user_id, tenant_id)
);

-- ─── MEDIA ────────────────────────────────────────────────────────────────────
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

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
create table categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  color     text,
  parent_id uuid references categories(id),  -- self-referential for subcategories
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
  description   text,                   -- richText stored as plain text or JSON
  price         numeric(10,2) not null,
  category_id   uuid references categories(id),
  image_id      uuid references media(id),
  cover_id      uuid references media(id),
  refund_policy text not null default '30-day'
                check (refund_policy in ('30-day','14-day','7-day','3-day','1-day','no-refunds')),
  content       text,                   -- protected post-purchase content
  is_private    boolean not null default false,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on products(tenant_id);
create index on products(category_id);
create index on products(is_archived, is_private);  -- common combined filter

-- ─── PRODUCT_TAGS (many-to-many) ──────────────────────────────────────────────
create table product_tags (
  product_id uuid not null references products(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────
create table orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references users(id),
  product_id                uuid not null references products(id),
  stripe_checkout_session_id text not null unique,
  stripe_account_id         text,
  created_at                timestamptz not null default now()
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
  unique (product_id, user_id)   -- one review per user per product
);
```

### Key Schema Design Decisions

| Decision | Rationale |
|----------|-----------|
| `users.id` references `auth.users(id)` | Supabase Auth owns the auth record; app table extends it. No duplicate user management. |
| `user_tenants` junction table | Replaces Payload's embedded `tenantsArrayField`. Cleaner FK constraints, easier querying. |
| `products.tenant_id` FK (not slug) | Enables RLS policies to join efficiently. Slug is on the tenants table only. |
| `media` as separate table | Supabase Storage owns the file; this table stores the metadata + URL. Enables FK references from products. |
| `product_tags` junction table | Replaces Payload's `hasMany: relationship to tags`. Normalized. |
| No soft-delete on categories/tags | They are admin-managed global data; hard delete with FK constraints is fine. |
| `orders.stripe_checkout_session_id` unique | Idempotency: Stripe webhook can retry without creating duplicate orders. |
| `reviews` unique on (product_id, user_id) | Enforces one review per user per product at DB level. |

---

## Supabase RLS Policies for Multi-Tenancy

### How Tenant Isolation Works

The current Payload implementation uses JavaScript-level filtering (`where["tenant.slug"] = { equals: tenantSlug }`). With Supabase, isolation moves to Postgres RLS — policies run inside the database engine before any data reaches the application. This is safer and eliminates any risk of a missed `where` clause leaking cross-tenant data.

The mechanism: when tRPC procedures call Supabase, the client sends the user's JWT. Supabase validates it and makes `auth.uid()` available inside RLS policy expressions. A custom claim `tenant_id` is embedded in the JWT via a Postgres function called on login, so policies can check `auth.jwt() -> 'tenant_id'` without an extra join.

### JWT Custom Claims for Tenant ID

```sql
-- Function to embed tenant_id into the JWT when user logs in.
-- Called automatically by Supabase Auth via a database hook.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql as $$
declare
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
begin
  -- Get this user's tenant and role
  select ut.tenant_id into user_tenant_id
  from user_tenants ut
  where ut.user_id = (event->>'user_id')::uuid
  limit 1;

  select u.role into user_role
  from users u
  where u.id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
  claims := jsonb_set(claims, '{app_role}',  to_jsonb(coalesce(user_role, 'user')));

  return jsonb_set(event, '{claims}', claims);
end;
$$;
```

### Helper Functions (used inside RLS policies)

```sql
-- Returns current user's tenant_id from JWT (no extra query)
create or replace function auth.tenant_id() returns uuid language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'tenant_id')::text::uuid,
    null
  )
$$;

-- Returns true if current user is super-admin
create or replace function auth.is_super_admin() returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'app_role') = 'super-admin',
    false
  )
$$;
```

### RLS Policies per Table

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

**Tenants table**

```sql
-- Anyone can read tenants (public store pages need tenant info)
create policy "tenants: public read"
  on tenants for select using (true);

-- Only super-admin can write tenants
create policy "tenants: super-admin write"
  on tenants for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Products table — the core tenant-isolation policy**

```sql
-- Public read: non-archived, non-private products are visible to everyone
create policy "products: public read"
  on products for select
  using (is_archived = false and is_private = false);

-- Tenant read: the owning tenant can see ALL their products (including private/archived)
create policy "products: owner read all"
  on products for select
  using (tenant_id = auth.tenant_id());

-- Tenant write: owning tenant can insert/update their own products only
create policy "products: owner insert"
  on products for insert
  with check (tenant_id = auth.tenant_id());

create policy "products: owner update"
  on products for update
  using (tenant_id = auth.tenant_id())
  with check (tenant_id = auth.tenant_id());

-- Super-admin can do anything
create policy "products: super-admin all"
  on products for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Orders table**

```sql
-- Users see only their own orders
create policy "orders: user read own"
  on orders for select
  using (user_id = auth.uid());

-- Only service role (Stripe webhook) inserts orders — handled server-side with service client
-- Super-admin sees all
create policy "orders: super-admin all"
  on orders for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());
```

**Reviews table**

```sql
-- Anyone can read reviews
create policy "reviews: public read"
  on reviews for select using (true);

-- Authenticated users can create reviews for products they purchased
-- (purchase check enforced in tRPC procedure, not RLS — simpler policy)
create policy "reviews: authenticated insert"
  on reviews for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Users can update/delete only their own reviews
create policy "reviews: owner update"
  on reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reviews: owner delete"
  on reviews for delete
  using (user_id = auth.uid());
```

**Categories and Tags (global, admin-managed)**

```sql
-- Public read
create policy "categories: public read" on categories for select using (true);
create policy "tags: public read"       on tags       for select using (true);

-- Super-admin write only
create policy "categories: super-admin write"
  on categories for all
  using (auth.is_super_admin()) with check (auth.is_super_admin());

create policy "tags: super-admin write"
  on tags for all
  using (auth.is_super_admin()) with check (auth.is_super_admin());
```

**Media table**

```sql
-- Public read (all media is publicly referenced by products)
create policy "media: public read" on media for select using (true);

-- Authenticated users can insert their own media
-- (tenant scoping handled in procedure — keeps policy simple)
create policy "media: authenticated insert"
  on media for insert with check (auth.uid() is not null);

-- Super-admin can delete
create policy "media: super-admin delete"
  on media for delete using (auth.is_super_admin());
```

### Two-Client Strategy

Some server-side operations must bypass RLS (Stripe webhook creating orders, admin operations). For these, use the **service role client**. For all user-facing operations, use the **anon/user client** that respects RLS.

| Client | When to Use | How Created |
|--------|------------|-------------|
| Anon client (cookie-based) | User-facing tRPC procedures, Server Components reading public data | `createServerClient(url, anonKey, { cookies })` |
| Service role client | Stripe webhook handler, admin bulk operations | `createClient(url, serviceRoleKey)` — never expose to browser |

---

## tRPC Context — Replacing `ctx.db` (Payload) with `ctx.supabase`

### Current pattern (Payload)

```typescript
// src/trpc/init.ts — CURRENT
export const baseProcedure = t.procedure.use(async ({ next }) => {
  const payload = await getPayload({ config });
  return next({ ctx: { db: payload } });
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const headers = await getHeaders();
  const session = await ctx.db.auth({ headers });
  if (!session.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: { ...session, user: session.user } } });
});
```

### Target pattern (Supabase)

```typescript
// src/trpc/init.ts — TARGET
import { initTRPC, TRPCError } from '@trpc/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import superjson from 'superjson';
import { cache } from 'react';
import type { Database } from '@/lib/supabase/types'; // generated types

export const createTRPCContext = cache(async () => {
  const cookieStore = await cookies();

  // Anon client — respects RLS, uses user's session from cookie
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase };
});

const t = initTRPC.create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Public procedure — Supabase anon client, RLS active
export const baseProcedure = t.procedure.use(async ({ next }) => {
  const { supabase } = await createTRPCContext();
  return next({ ctx: { supabase } });
});

// Protected procedure — verified session required
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const { data: { user }, error } = await ctx.supabase.auth.getUser();

  if (error || !user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Fetch app-level user record (role, etc.)
  const { data: appUser } = await ctx.supabase
    .from('users')
    .select('id, username, role')
    .eq('id', user.id)
    .single();

  return next({
    ctx: {
      ...ctx,
      user: { ...user, ...appUser },
    },
  });
});

// Super-admin procedure — role check on top of authentication
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'super-admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});
```

### How Existing Procedures Change

The `ctx.db.*` calls are replaced 1-for-1 with Supabase query builder calls. The logic stays the same; only the data access syntax changes.

**Example: products.getMany (before → after)**

```typescript
// BEFORE (Payload)
const data = await ctx.db.find({
  collection: "products",
  where: { "tenant.slug": { equals: input.tenantSlug }, isArchived: { not_equals: true } },
  page: input.cursor,
  limit: input.limit,
});

// AFTER (Supabase — tenant isolation handled by RLS, no explicit tenant filter needed
// when the anon client is used by an authenticated tenant user)
let query = ctx.supabase
  .from('products')
  .select(`
    *,
    category:categories(id, name, slug, color),
    image:media!products_image_id_fkey(id, url, alt),
    tenant:tenants(id, name, slug, image:media(id, url))
  `)
  .eq('is_archived', false)
  .range((input.cursor - 1) * input.limit, input.cursor * input.limit - 1);

// Public storefront: hide private products
if (!input.tenantSlug) {
  query = query.eq('is_private', false);
}

// Filter by tenant slug (for storefront pages)
if (input.tenantSlug) {
  query = query.eq('tenants.slug', input.tenantSlug);  // join filter
}
```

### Service Role Client for Webhook

```typescript
// src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Singleton — instantiated once at module load, never in request handlers
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only, never exposed to client
);

// Used in: src/app/(app)/api/stripe/webhooks/route.ts
// await supabaseAdmin.from('orders').insert({ ... });
```

---

## Supabase Auth Integration with Next.js 15 Middleware

### What Middleware Must Do

The current `middleware.ts` has one job: extract tenant slug from hostname and rewrite URLs. Post-migration it has two jobs: **session refresh** (Supabase Auth requirement) and tenant routing. These must be combined carefully — Supabase's middleware pattern must run before the rewrite.

### Pattern

```typescript
// src/middleware.ts — TARGET
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|_vercel|media/|[\\w-]+\\.\\w+).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  // ── Step 1: Build a response object we can write session cookies into ──
  let response = NextResponse.next({ request: req });

  // ── Step 2: Create Supabase server client (reads + writes session cookies) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            req.cookies.set(name, value)
          );
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Step 3: Refresh session (MUST call getUser, not getSession) ──
  // This silently refreshes the access token if it has expired.
  // Do NOT use getSession() here — it does not validate the token.
  await supabase.auth.getUser();

  // ── Step 4: Tenant routing (unchanged from current implementation) ──
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';

  if (hostname.endsWith(`.${rootDomain}`)) {
    const tenantSlug = hostname.replace(`.${rootDomain}`, '');
    return NextResponse.rewrite(
      new URL(`/tenants/${tenantSlug}${url.pathname}`, req.url)
    );
  }

  return response;
}
```

### Critical Notes

- **Use `getUser()` not `getSession()` in middleware.** `getSession()` reads from the cookie without server-side validation — it can be spoofed. `getUser()` makes a network call to Supabase Auth to validate the JWT. This is required by Supabase's security model for middleware.
- **The `response` object must be the one with refreshed cookies.** The pattern above ensures that when a rewrite is returned, it carries the updated session cookie. If the rewrite is returned before `setAll` runs, the token refresh is lost.
- **Admin route protection.** Add a check after `getUser()` to redirect non-admins away from `/admin`:

```typescript
// After Step 3, before Step 4:
const { data: { user } } = await supabase.auth.getUser();
if (url.pathname.startsWith('/admin')) {
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }
  // Role check handled inside the admin layout (server component reads DB)
}
```

---

## Custom Admin UI Architecture

### Where It Lives

```
src/app/(admin)/
├── layout.tsx          ← admin shell: sidebar nav, role guard (server component)
├── page.tsx            ← dashboard overview (stats)
├── products/
│   ├── page.tsx        ← product list with edit/delete
│   └── [id]/
│       └── page.tsx    ← product detail form
├── tenants/
│   ├── page.tsx        ← tenant list
│   └── [id]/
│       └── page.tsx    ← tenant detail (stripe status, toggle verified)
├── users/
│   └── page.tsx        ← user list
├── categories/
│   ├── page.tsx        ← category tree view
│   └── [id]/page.tsx
├── tags/
│   └── page.tsx
├── orders/
│   └── page.tsx        ← read-only order history
└── media/
    └── page.tsx        ← file browser
```

### Design Principles

- **Route group `(admin)` keeps it separate from `(app)`.** No URL segment added; just for organization and to allow a different layout.
- **The layout is a Server Component that reads the user's role from Supabase.** If `role !== 'super-admin'`, it renders a 403 page rather than redirecting (middleware handles redirect for unauthenticated; layout handles authorization for wrong role).
- **All admin data operations go through tRPC `adminProcedure`.** This keeps authorization in one place (`adminProcedure` checks `role === 'super-admin'`). No direct Supabase calls from admin page components.
- **Forms use React Hook Form + Zod** (same pattern as the existing auth module).
- **No new UI library needed.** The existing shadcn/ui components (`Table`, `Form`, `Dialog`, `Button`) cover all admin needs.

### Admin Layout Pattern

```typescript
// src/app/(admin)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (appUser?.role !== 'super-admin') {
    return <div>403 — Brak dostępu.</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### Admin tRPC Router

```typescript
// src/modules/admin/server/procedures.ts
export const adminRouter = createTRPCRouter({
  // Products
  products: {
    list:   adminProcedure.input(...).query(async ({ ctx, input }) => { ... }),
    update: adminProcedure.input(...).mutation(async ({ ctx, input }) => { ... }),
    delete: adminProcedure.input(...).mutation(async ({ ctx, input }) => { ... }),
  },
  // Tenants
  tenants: {
    list:            adminProcedure.query(...),
    setVerified:     adminProcedure.input(...).mutation(...),
  },
  // Categories — full CRUD
  categories: {
    list:   adminProcedure.query(...),
    create: adminProcedure.input(...).mutation(...),
    update: adminProcedure.input(...).mutation(...),
    delete: adminProcedure.input(...).mutation(...),
  },
  // Tags
  tags: { list: ..., create: ..., delete: ... },
  // Orders — read-only
  orders: { list: adminProcedure.query(...) },
});
```

---

## Data Flow (Post-Migration)

### Multi-Tenant Request Flow

```
1. Request: "artist.ferment.com/products"
2. middleware.ts:
   a. createServerClient with cookies → supabase.auth.getUser() (token refresh)
   b. hostname "artist.ferment.com" matches *.ferment.com
   c. rewrite → "/tenants/artist/products" with refreshed session cookie
3. Page component renders:
   a. tRPC prefetch: productsRouter.getMany({ tenantSlug: "artist" })
   b. baseProcedure builds Supabase anon client with user session from cookies
   c. Query: supabase.from('products').select(...).eq('tenants.slug', 'artist').eq('is_archived', false)
   d. RLS: authenticated tenant user sees own private products too; anon sees only public
4. React Query dehydrates → client hydrates (unchanged)
```

### Authentication Flow

```
1. User submits sign-up form
2. authRouter.register mutation:
   a. supabase.auth.signUp({ email, password })     → creates auth.users record
   b. stripe.accounts.create({})                    → creates Stripe Connected Account
   c. supabase.from('tenants').insert({ name, slug, stripe_account_id })
   d. supabase.from('users').insert({ id: authUser.id, username, role: 'user' })
   e. supabase.from('user_tenants').insert({ user_id, tenant_id })
   f. Supabase Auth sets session cookie automatically (via signUp response)
3. Middleware refreshes token on next request → JWT carries tenant_id claim
```

### Stripe Webhook Flow

```
1. POST /api/stripe/webhooks
2. Verify stripe signature (unchanged)
3. On 'checkout.session.completed':
   a. Use supabaseAdmin (service role — bypasses RLS)
   b. supabaseAdmin.from('orders').insert({ user_id, product_id, stripe_checkout_session_id, stripe_account_id })
4. Return 200
```

### Product Purchase Flow (unchanged conceptually)

```
1. checkoutRouter.purchase (protectedProcedure):
   a. ctx.supabase.from('products').select(...).in('id', productIds) — validates products exist + tenant match
   b. ctx.supabase.from('tenants').select('stripe_account_id, stripe_details_submitted').eq('slug', tenantSlug)
   c. stripe.checkout.sessions.create({ stripeAccount: tenant.stripe_account_id, ... })
2. Return checkout URL → redirect to Stripe
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using `getSession()` in Middleware
**What:** Calling `supabase.auth.getSession()` in `middleware.ts` instead of `getUser()`.
**Why bad:** `getSession()` reads the cookie without contacting Supabase Auth servers, so a tampered cookie can bypass authentication. Supabase's security docs explicitly require `getUser()` in middleware.
**Instead:** Always `await supabase.auth.getUser()` in middleware.

### Anti-Pattern 2: Service Role Client in the Browser
**What:** Importing `supabaseAdmin` (service role key) in a Client Component or exposing `SUPABASE_SERVICE_ROLE_KEY` in public env vars.
**Why bad:** The service role key bypasses all RLS policies. Exposing it to the browser allows anyone to read or delete any data.
**Instead:** Service role client lives only in `src/lib/supabase/service.ts`, used only in server-side route handlers (Stripe webhook). Never in tRPC procedures called from the browser.

### Anti-Pattern 3: Filtering Tenant in Application Code Instead of RLS
**What:** Adding `where tenant_id = $tenantId` in every tRPC procedure manually, trusting JS to enforce isolation.
**Why bad:** One missed filter = data leak. RLS enforces isolation at the DB engine level; application-level filtering is defense-in-depth at best.
**Instead:** Write the RLS policies correctly. Trust them. The application can still add tenant filters for correctness/performance (index use), but RLS is the security boundary.

### Anti-Pattern 4: Calling Supabase Directly from Client Components
**What:** Creating a browser Supabase client in React components and calling `supabase.from('products').select()` directly.
**Why bad:** Bypasses tRPC type safety, breaks the data access layer, and makes it impossible to add server-side logic (e.g., Stripe checks) later. Also harder for a non-programmer owner to maintain.
**Instead:** All data access goes through tRPC procedures. The browser client (`src/lib/supabase/client.ts`) is used only for auth state subscription (`onAuthStateChange`), if at all.

### Anti-Pattern 5: Storing Tenant Slug Instead of Tenant ID as FK
**What:** Using `tenant_slug text` as a foreign key in `products`, `orders`, etc. instead of `tenant_id uuid`.
**Why bad:** Slugs can change (though rare); UUIDs are immutable. UUID FKs enable proper referential integrity and work with RLS policies that use `auth.tenant_id()` (which returns a UUID).
**Instead:** Always FK on `tenant_id uuid`. Slug lives only in the `tenants` table and is only used for URL routing/display.

---

## Build Order

The dependency chain below dictates what must be implemented before what.

```
Phase 1: Foundation
  ├── Supabase project setup (URL, keys)
  ├── Database schema (all 8 tables + indexes)
  ├── RLS policies (all tables)
  ├── JWT custom claims hook (tenant_id, app_role in token)
  └── supabase type generation (supabase gen types → src/lib/supabase/types.ts)

Phase 2: Auth Migration                    [depends on Phase 1]
  ├── src/lib/supabase/server.ts (cookie client factory)
  ├── src/lib/supabase/service.ts (service role singleton)
  ├── src/middleware.ts update (getUser + tenant rewrite)
  ├── src/trpc/init.ts update (baseProcedure/protectedProcedure/adminProcedure)
  └── authRouter rewrite (register, login, session → Supabase Auth)

Phase 3: Data Migration Script             [depends on Phase 1]
  ├── Read all MongoDB collections via Payload
  ├── Map to Postgres schema (ID remapping, flatten relations)
  └── Insert via supabaseAdmin (bypasses RLS for initial load)

Phase 4: tRPC Procedure Migration          [depends on Phase 2]
  ├── productsRouter (getOne, getMany)     → ctx.supabase queries
  ├── categoriesRouter                     → ctx.supabase queries
  ├── checkoutRouter (purchase, verify)    → ctx.supabase + Stripe (unchanged)
  ├── tenantsRouter                        → ctx.supabase queries
  ├── reviewsRouter                        → ctx.supabase queries
  ├── tagsRouter                           → ctx.supabase queries
  └── libraryRouter (getMany orders)       → ctx.supabase queries

Phase 5: Storage Migration                 [depends on Phase 3]
  ├── Create Supabase Storage buckets (products, tenants)
  ├── Re-upload all Vercel Blob files to Supabase Storage
  └── Update media.url + media.storage_path in DB

Phase 6: Custom Admin UI                   [depends on Phase 4]
  ├── adminRouter (all CRUD procedures)
  ├── src/app/(admin)/ route group + layout
  └── Admin page components (tables, forms)

Phase 7: Payload Removal                   [depends on Phase 4, 5, 6]
  ├── Remove src/collections/*.ts
  ├── Remove src/payload.config.ts
  ├── Remove src/app/(payload)/
  ├── Remove @payloadcms/* from package.json
  └── Remove payload-types.ts, replace with Supabase generated types
```

### Rationale for Ordering

- **Schema before auth**: Auth JWT claims reference `users` and `user_tenants` tables. Tables must exist before the hook function can query them.
- **Auth before procedures**: `ctx.supabase` depends on the new `init.ts`. All procedures depend on the new context.
- **Data migration before storage migration**: Media rows must exist in Postgres before updating their URLs.
- **Procedures before admin UI**: Admin UI uses `adminProcedure` — that procedure must be wired up before building the UI.
- **Payload removal last**: Keep Payload running in parallel during migration to avoid a "big bang" cutover. Remove only when every procedure has been migrated and verified.

---

## Scalability Considerations

| Concern | At ~10 artists (current) | At 100 artists | At 1,000 artists |
|---------|--------------------------|----------------|------------------|
| Tenant isolation | RLS policies, no change needed | Same | Same — RLS scales with Postgres |
| Product queries | Single `products` table, fast | Add composite index on `(tenant_id, is_archived)` | Partitioning by tenant_id if needed |
| Auth token refresh | `getUser()` on every middleware call | Same — Supabase CDN caches validation | Same |
| Admin UI | Single admin user, no concern | Same | Same |
| Storage | Supabase Storage CDN-backed | Same | Consider separate CDN layer |

At the current scale (this is a real but small marketplace), no scalability concerns are relevant. The schema and RLS design is solid for 10x growth without changes.

---

## Sources

- Supabase SSR Auth with Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs (HIGH confidence — official docs)
- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security (HIGH confidence — official docs)
- Supabase custom JWT claims / hooks: https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control-rbac (HIGH confidence — official docs)
- tRPC context documentation: https://trpc.io/docs/server/context (HIGH confidence — official docs)
- Current codebase: src/trpc/init.ts, src/middleware.ts, src/collections/*.ts (HIGH confidence — read directly)
- Next.js 15 middleware patterns: https://nextjs.org/docs/app/building-your-application/routing/middleware (HIGH confidence — stable API)

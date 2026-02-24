# Technology Stack: Supabase Migration

**Project:** Ferment Platforma — Payload CMS + MongoDB to Supabase
**Researched:** 2026-02-24
**Scope:** Stack dimension for brownfield migration

---

## Recommended Stack

### Supabase Core Packages

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` | `^2.49.x` | Universal Supabase client (queries, auth, storage) | The single entry-point for all Supabase SDK operations. Replaces all Payload CMS data-access calls. |
| `@supabase/ssr` | `^0.5.x` | Next.js / server-side rendering cookie adapter | Handles cookie-based session persistence across Server Components, Route Handlers, middleware, and Server Actions. Required for App Router auth — the old `@supabase/auth-helpers-nextjs` is deprecated. |

**Confidence: MEDIUM.** `@supabase/supabase-js` v2.x is the stable, current major. `@supabase/ssr` v0.5.x was the released version as of mid-2025 and is Supabase's recommended replacement for the deprecated auth-helpers. Verify exact patch versions at install time with `npm view @supabase/ssr version`.

**NOT needed:**

| Package | Why Not |
|---------|---------|
| `@supabase/auth-helpers-nextjs` | Deprecated by Supabase in favour of `@supabase/ssr`. Do not install. |
| `@supabase/auth-ui-react` | Pre-built auth UI — not appropriate here since the app already has custom auth forms with react-hook-form + shadcn/ui. |
| `@supabase/realtime-js` | Standalone realtime client. Already bundled inside `@supabase/supabase-js`. No separate install needed. |

---

### Database Access Layer

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` (built-in client) | — | Primary data access via PostgREST auto-generated API | Supabase's JS client wraps PostgREST and provides a fluent query builder. No separate ORM required for the migration scope. Use `supabase.from('products').select(...)` directly in tRPC procedures. |

**NOT recommended for this project:**

| Package | Why Not |
|---------|---------|
| `drizzle-orm` + `drizzle-kit` | Adds significant complexity — schema files, migration CLI, separate type generation. Not justified for a migration-only project where the goal is maintainability by a non-programmer owner. The Supabase client's query builder is sufficient and simpler. |
| `prisma` | Same concern. Prisma requires a separate schema, generator, and migration pipeline. The Supabase client already provides typed queries via `supabase.from()` and PostgREST. |

**Confidence: MEDIUM.** The Supabase JS client's query builder handles all CRUD needed for this app's 8 collections. A dedicated ORM would add indirection without meaningful benefit at this scale. Revisit if complex multi-table joins become a bottleneck — Supabase also supports raw SQL via `.rpc()` for stored procedures.

---

### Authentication

Supabase Auth replaces Payload's cookie-based auth. The migration touch points are:

| Component | Current (Payload) | After Migration (Supabase) |
|-----------|-------------------|---------------------------|
| Session storage | Payload encrypted cookies | Supabase JWT in HTTP-only cookies (via `@supabase/ssr`) |
| Auth check in tRPC | `ctx.db.auth({ headers })` | `supabase.auth.getUser()` |
| User table | Payload `users` collection (MongoDB) | Supabase `auth.users` (managed) + optional `public.profiles` table |
| Admin user creation | Payload admin panel | Supabase dashboard or SQL |

**Confidence: HIGH.** Supabase Auth with SSR package is the standard, well-documented path for Next.js 15 App Router.

---

### File Storage

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| Built-in via `@supabase/supabase-js` | — | Upload/download files, generate signed/public URLs | `supabase.storage.from('bucket').upload(...)` — no separate package needed. Replaces `@payloadcms/storage-vercel-blob`. |

---

### Packages to Remove

All of the following must be uninstalled and purged from `package.json`:

```bash
npm uninstall \
  payload \
  @payloadcms/db-mongodb \
  @payloadcms/next \
  @payloadcms/payload-cloud \
  @payloadcms/plugin-multi-tenant \
  @payloadcms/richtext-lexical \
  @payloadcms/storage-vercel-blob \
  graphql
```

Also delete:
- `src/payload.config.ts` — entire Payload configuration
- `src/collections/` — replace with Supabase table definitions (SQL migrations)
- `src/app/(payload)/` — Payload admin routes
- `src/lib/access.ts` — Payload access control helpers (replace with RLS)
- Path alias `@payload-config` in `tsconfig.json`

Environment variables to remove: `DATABASE_URI`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`

Environment variables to add: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Configuration Patterns

### Pattern 1: Three Supabase Client Factories (Required by @supabase/ssr)

`@supabase/ssr` requires three distinct client creation functions, each bound to a different cookie access mechanism in Next.js:

**`src/lib/supabase/server.ts`** — Server Components and Route Handlers:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
            // Server Component: cookie mutation ignored (middleware handles refresh)
          }
        },
      },
    }
  )
}
```

**`src/lib/supabase/middleware.ts`** — Next.js middleware (CRITICAL for session refresh):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
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

  // IMPORTANT: Do not run auth logic between createServerClient and supabase.auth.getUser()
  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

**`src/lib/supabase/client.ts`** — Client Components only:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/supabase/admin.ts`** — Server-only, bypasses RLS (for admin procedures and data migration):

```typescript
import { createClient } from '@supabase/supabase-js'
import 'server-only'

// Uses service role key — NEVER expose to client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

**Confidence: HIGH.** This four-client pattern is the canonical Supabase + Next.js App Router architecture documented by Supabase. The middleware client is especially critical — without it, tokens expire silently.

---

### Pattern 2: Wiring Supabase into tRPC Context (Replacing `ctx.db`)

The current `src/trpc/init.ts` passes Payload as `ctx.db`. The migration replaces this with a Supabase client and authenticated user.

**Current pattern:**

```typescript
// ctx.db = Payload instance
export const baseProcedure = t.procedure.use(async ({ next }) => {
  const payload = await getPayload({ config });
  return next({ ctx: { db: payload } });
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const headers = await getHeaders();
  const session = await ctx.db.auth({ headers }); // Payload auth
  if (!session.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session } });
});
```

**Target pattern for `src/trpc/init.ts`:**

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { createClient } from '@/lib/supabase/server';
import superjson from 'superjson';
import { cache } from 'react';

export const createTRPCContext = cache(async () => {
  const supabase = await createClient();
  return { supabase };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Public procedures — supabase client available, no auth required
export const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
  return next({ ctx });
});

// Protected procedures — validates active Supabase session
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const { data: { user }, error } = await ctx.supabase.auth.getUser();

  if (error || !user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user, // typed Supabase User object
    },
  });
});
```

**Key differences from Payload pattern:**
- `ctx.db` (Payload instance) → `ctx.supabase` (Supabase client)
- `ctx.db.auth({ headers })` → `ctx.supabase.auth.getUser()`
- User type changes from Payload User to Supabase `User` from `@supabase/supabase-js`
- All procedure files that reference `ctx.db.find(...)` must be updated to `ctx.supabase.from('table').select(...)`

**Confidence: HIGH.** This is a direct structural mapping — the tRPC middleware chain is identical in concept, only the database client changes.

---

### Pattern 3: Next.js 15 Middleware Integration

The existing `src/middleware.ts` handles subdomain routing. After migration it must also handle Supabase session refresh. These are composed together:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|_vercel|media/|[\\w-]+\\.\\w+).*)',
  ],
}

export default async function middleware(req: NextRequest) {
  // 1. Run Supabase session refresh (must come first)
  const { supabaseResponse } = await updateSession(req)

  // 2. Apply existing subdomain routing logic
  const url = req.nextUrl
  const hostname = req.headers.get('host') || ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''

  if (hostname.endsWith(`.${rootDomain}`)) {
    const tenantSlug = hostname.replace(`.${rootDomain}`, '')
    // Rewrite the URL but keep the supabase cookie response
    const rewrittenUrl = new URL(`/tenants/${tenantSlug}${url.pathname}`, req.url)
    const rewriteResponse = NextResponse.rewrite(rewrittenUrl)
    // Forward Supabase cookies to the rewrite response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie.name, cookie.value)
    })
    return rewriteResponse
  }

  return supabaseResponse
}
```

**Why Supabase must run first in middleware:** `@supabase/ssr` rotates short-lived JWT tokens. If the session refresh doesn't happen before the subdomain rewrite, subsequent server component calls will see an expired token and require re-login. Cookie forwarding on rewrite responses ensures the refreshed token reaches the browser.

**Confidence: HIGH.** Cookie forwarding pattern is required when combining Supabase SSR with Next.js rewrites — documented by both Supabase and the Next.js community.

---

### Pattern 4: Multi-Tenancy with Row Level Security (Replacing Payload Plugin)

Payload's `@payloadcms/plugin-multi-tenant` is replaced with Supabase RLS policies on the `products` and `media` tables. The middleware subdomain routing stays identical — only the data isolation mechanism changes.

**Schema requirement:**

```sql
-- products table must have a tenant_id foreign key
ALTER TABLE products ADD COLUMN tenant_id uuid REFERENCES tenants(id);

-- RLS policy: public reads scoped to tenant
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (
    tenant_id = (
      SELECT id FROM tenants WHERE slug = current_setting('app.tenant_slug', true)
    )
  );

-- Set tenant context in tRPC procedures (via Supabase RPC or SET LOCAL)
```

**tRPC procedure pattern for tenant-scoped queries:**

```typescript
// In baseProcedure middleware or per-router, extract tenant from request context
// Option A: Pass tenant slug via tRPC input (explicit, simpler)
// Option B: Set PostgreSQL session variable and rely on RLS (cleaner, but more setup)

// For migration Phase 1, Option A (explicit tenant filter) is lower risk:
export const productsProcedure = baseProcedure.input(
  z.object({ tenantSlug: z.string().optional(), ...otherInput })
).query(async ({ ctx, input }) => {
  const query = ctx.supabase.from('products').select('*')
  if (input.tenantSlug) {
    query.eq('tenant.slug', input.tenantSlug)
  }
  return query
})
```

**Confidence: MEDIUM.** RLS is the correct Supabase pattern for multi-tenancy. The session variable approach (`SET LOCAL app.tenant_slug`) requires calling a Supabase RPC before each query — viable but adds complexity. Explicit tenant filter on every query is simpler and safer for the migration phase.

---

## Installation

```bash
# Add Supabase packages
npm install @supabase/supabase-js @supabase/ssr

# Remove Payload CMS packages
npm uninstall \
  payload \
  @payloadcms/db-mongodb \
  @payloadcms/next \
  @payloadcms/payload-cloud \
  @payloadcms/plugin-multi-tenant \
  @payloadcms/richtext-lexical \
  @payloadcms/storage-vercel-blob \
  graphql
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Supabase client | `@supabase/supabase-js` v2 | `@supabase/supabase-js` v1 | v1 is EOL; v2 has breaking API changes but is the only supported version |
| SSR adapter | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is officially deprecated by Supabase and not maintained for Next.js 15 |
| ORM | None (Supabase client query builder) | Drizzle ORM | Adds schema file, migration CLI, type generation — disproportionate complexity for an owner who needs readable, maintainable code |
| ORM | None (Supabase client query builder) | Prisma | Same as Drizzle; also has known edge runtime compatibility issues with Next.js middleware |
| Auth | Supabase Auth | NextAuth.js / Auth.js | Would not use Supabase's built-in user management or RLS `auth.uid()` — forces a second auth system alongside Supabase |
| Storage | Supabase Storage (built-in) | Keep Vercel Blob | Consolidating to one platform (DB + Auth + Storage) is a stated project goal; Supabase Storage supports the same upload patterns |

---

## Environment Variables

**Remove:**
```
DATABASE_URI         # MongoDB connection string
PAYLOAD_SECRET       # Payload session encryption key
BLOB_READ_WRITE_TOKEN # Vercel Blob token
```

**Add:**
```
NEXT_PUBLIC_SUPABASE_URL        # Project URL from Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Anon/public key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY       # Service role key (server-only, bypasses RLS)
```

**Retain unchanged:**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ROOT_DOMAIN
NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING
NODE_ENV
```

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| `@supabase/supabase-js` v2 | HIGH | Stable major version, well-documented, no breaking changes since v2 GA |
| `@supabase/ssr` as auth-helpers replacement | HIGH | Supabase officially deprecated auth-helpers in favour of this package |
| Three-client factory pattern | HIGH | Canonical pattern in Supabase's own Next.js App Router guide |
| tRPC context migration (`ctx.db` → `ctx.supabase`) | HIGH | Direct structural equivalence — same middleware chain, different client |
| Middleware session + subdomain composition | MEDIUM | Cookie forwarding on rewrites is standard but has edge cases; verify in integration testing |
| RLS for multi-tenancy | MEDIUM | Correct conceptual approach, but specific policy design depends on schema decisions made in the migration |
| Exact package patch versions | LOW | Training data cutoff is August 2025; verify at install time with `npm view @supabase/ssr version` |
| No ORM recommendation | MEDIUM | Decision based on project complexity and owner profile — reassess if query complexity grows post-migration |

---

## Sources

- Supabase Next.js App Router guide (canonical): https://supabase.com/docs/guides/auth/server-side/nextjs
- `@supabase/ssr` package: https://github.com/supabase/supabase-js/tree/master/packages/ssr
- Supabase Auth Helpers deprecation notice: https://supabase.com/docs/guides/auth/auth-helpers/nextjs (redirects to `@supabase/ssr`)
- tRPC context documentation: https://trpc.io/docs/server/context
- Supabase RLS multi-tenancy: https://supabase.com/docs/guides/database/postgres/row-level-security

*Note: External research tools were unavailable during this session. All findings are based on training data (cutoff August 2025) with confidence levels assigned accordingly. Verify package versions at install time.*

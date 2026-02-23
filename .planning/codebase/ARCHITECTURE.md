# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Multi-tenant SaaS marketplace with full-stack Next.js + Payload CMS, featuring creator stores with integrated payments

**Key Characteristics:**
- Multi-tenant architecture with tenant-aware data isolation
- Server-driven rendering with React Query hydration patterns
- Feature-based module organization with co-located UI/server logic
- tRPC-based API with type-safe backend-frontend communication
- Stripe integration for payments and merchant onboarding

## Layers

**Presentation (Client):**
- Purpose: React components and pages using Server Components + Client Components hybrid model
- Location: `src/app/(app)`, `src/modules/*/ui`
- Contains: Page components, layouts, UI components, client-side stores
- Depends on: tRPC client, React Query, Zustand for state
- Used by: Browser clients, Next.js request handlers

**API & Business Logic (Server):**
- Purpose: Type-safe RPC procedures handling data validation, authorization, and business operations
- Location: `src/modules/*/server/procedures.ts`, `src/trpc`
- Contains: tRPC router definitions, protected/public procedures, business logic
- Depends on: Payload CMS (database layer), Stripe SDK, authentication context
- Used by: Frontend pages (prefetching), API routes

**Data Access (Database):**
- Purpose: Payload CMS collections defining schema, access control, and multi-tenant queries
- Location: `src/collections/*.ts`
- Contains: Collection definitions with field schemas, hooks, access policies
- Depends on: Payload framework, MongoDB adapter
- Used by: tRPC procedures, Payload admin interface

**Infrastructure:**
- Purpose: Middleware, routing, configuration, and external service integration
- Location: `src/middleware.ts`, `src/payload.config.ts`, `src/app/api/`
- Contains: Request routing, tenant detection, webhook handlers, Payload configuration
- Depends on: Next.js framework, external APIs (Stripe)
- Used by: All application layers

## Data Flow

**User Authentication & Registration:**

1. User submits registration form via `POST /api/trpc`
2. `authRouter.register` procedure validates input with `registerSchema` (zod)
3. Creates Stripe Connected Account for seller capability
4. Creates `tenants` collection record (store) linked to Stripe Account ID
5. Creates `users` collection record with tenant relationship
6. Returns authentication token via cookie
7. Middleware detects request headers, routes to tenant subdomain if applicable

**Product Browse & Purchase Flow:**

1. SSR page fetches categories/products via `trpc` server-side prefetch
2. `productsRouter.getMany` queries with tenant/category filters
3. React Query dehydrates server state, hydrates client
4. Client-side `useCartStore` (Zustand) manages cart in localStorage
5. User adds products to cart (updates Zustand store)
6. Checkout page calls `checkoutRouter.purchase` procedure
7. Creates Stripe Checkout Session with line items
8. Redirects to Stripe Checkout URL
9. On completion, Stripe webhook hits `/api/stripe/webhooks`
10. Webhook creates `orders` collection records for each line item

**Multi-Tenant Request Flow:**

1. Request arrives with Host header (e.g., "antonio.ferment.com")
2. Middleware in `src/middleware.ts` extracts tenant slug from hostname
3. Rewrites to `/tenants/[slug]` internal route
4. Product queries filtered by `tenant.slug` equality
5. Response scoped to tenant's products only

**State Management:**

- Server-side: React Query cache + tRPC context (Payload instance)
- Client-side: React Query for server state, Zustand for checkout cart
- Persistent: LocalStorage cart data via Zustand middleware

## Key Abstractions

**Collection (Payload Schema):**
- Purpose: Defines database schema, validation, and access control per entity
- Examples: `src/collections/Products.ts`, `src/collections/Tenants.ts`, `src/collections/Orders.ts`
- Pattern: Export `CollectionConfig` with `fields`, `access`, `hooks`

**Module (Feature Namespace):**
- Purpose: Groups related functionality (UI, server logic, types, hooks) together
- Examples: `src/modules/checkout`, `src/modules/products`, `src/modules/auth`
- Pattern: `{module}/server/procedures.ts` for tRPC routes, `{module}/ui/` for components, `{module}/store/` for client state, `{module}/types.ts` for schemas

**Procedure (tRPC Route):**
- Purpose: Type-safe backend function with built-in validation and auth
- Examples: `authRouter.register`, `productsRouter.getMany`, `checkoutRouter.purchase`
- Pattern: Define with `baseProcedure` or `protectedProcedure`, chain `.input(schema).query()/mutation()`

**Store (Zustand):**
- Purpose: Client-side state management with persistence
- Examples: `src/modules/checkout/store/use-cart-store.ts`
- Pattern: `create<State>()(persist((set) => ({...}), {name: '...', storage: createJSONStorage(...)}))`

## Entry Points

**Web Application:**
- Location: `src/app/layout.tsx` (root layout)
- Triggers: Browser HTTP request to any route
- Responsibilities: Renders React tree, applies global providers, wraps with query client

**Page Rendering:**
- Location: `src/app/(app)/(home)/page.tsx` and similar
- Triggers: Route match (category, product listing, tenant store)
- Responsibilities: Prefetch data with `trpc` SSR, dehydrate for client, render `ProductListView`

**API Routes:**
- Location: `src/app/(app)/api/trpc/[trpc]/route.ts`, `src/app/(app)/api/stripe/webhooks/route.ts`
- Triggers: POST/GET to `/api/trpc` or webhook from Stripe
- Responsibilities: Handle tRPC requests or process Stripe events

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every HTTP request (except /api, /_next, static files)
- Responsibilities: Extract tenant from hostname, rewrite to `/tenants/[slug]`

**Payload Admin:**
- Location: `src/app/(payload)/admin/[[...segments]]/page.tsx`
- Triggers: Request to `/admin` route
- Responsibilities: Render Payload CMS admin dashboard

## Error Handling

**Strategy:** Error propagation via tRPC with typed error codes

**Patterns:**

- **Server Validation:** Zod schemas validate input, throw `ZodError` caught by tRPC middleware
- **Authorization:** Check `isSuperAdmin()` helper or access control hooks, throw `TRPCError` with code "UNAUTHORIZED"
- **Not Found:** Throw `TRPCError({code: 'NOT_FOUND', message: '...'})` when resource missing
- **Bad Request:** Throw `TRPCError({code: 'BAD_REQUEST', message: '...'})` for constraint violations
- **Webhook Errors:** Catch and log in Stripe webhook handler, return 400 with error message

## Cross-Cutting Concerns

**Logging:** Console statements for key events (webhook processing, errors) - see `src/app/(app)/api/stripe/webhooks/route.ts` with "✅ Success" and "❌ Error" messages

**Validation:** Zod schemas defined per module (e.g., `src/modules/auth/schemas.ts`, `src/modules/products/search-params.ts`). Input validation chained in procedure definitions: `.input(schema)`

**Authentication:** Payload built-in auth via headers. tRPC `protectedProcedure` extracts session with `ctx.db.auth({ headers })`, throws "UNAUTHORIZED" if no user. Super-admin checks via `isSuperAdmin()` helper in `src/lib/access.ts`

**Multi-Tenancy:** Middleware rewrites hostname-based requests. Payload multi-tenant plugin scopes products/media to tenants. Access control checks tenant relationship: verify `req.user.tenants[0].tenant` matches query target

---

*Architecture analysis: 2026-02-23*

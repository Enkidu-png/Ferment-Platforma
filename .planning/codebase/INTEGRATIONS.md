# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**Payment Processing:**
- Stripe - E-commerce payments and checkout
  - SDK/Client: stripe v18.0.0
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Usage: Checkout sessions, Connect accounts for tenant payments, webhook handling
  - Webhook endpoint: `POST /api/stripe/webhooks`

## Data Storage

**Databases:**
- MongoDB
  - Connection: `DATABASE_URI` environment variable
  - Client: @payloadcms/db-mongodb (Mongoose adapter)
  - Adapter location: `src/payload.config.ts` line 43

**File Storage:**
- Vercel Blob storage
  - Configuration: @payloadcms/storage-vercel-blob v3.34.0
  - Auth token: `BLOB_READ_WRITE_TOKEN` environment variable
  - Used for: Media collection uploads
  - Setup location: `src/payload.config.ts` lines 59-65

**Caching:**
- None configured (relies on React Query for client-side caching)

## Authentication & Identity

**Auth Provider:**
- Payload CMS built-in authentication
  - Implementation: Cookie-based sessions
  - Collection: Users (`src/collections/Users.ts`)
  - Auth config: `src/payload.config.ts` lines 38-46
  - Protected procedure check: `src/trpc/init.ts` lines 33-53 (via headers)

**Session Management:**
- Server-side via Payload CMS
- Payload auth headers → TRPC protected procedures
- Multi-tenant aware: Tenants array field via `@payloadcms/plugin-multi-tenant`

## Monitoring & Observability

**Error Tracking:**
- None detected (basic console logging in place)

**Logs:**
- Console logging (console.log/console.error)
- Example: `src/app/(app)/api/stripe/webhooks/route.ts` lines 26, 33

## CI/CD & Deployment

**Hosting:**
- Vercel-compatible (Next.js deployment)
- Middleware configured: `src/middleware.ts`

**CI Pipeline:**
- Not detected (no GitHub Actions, CI config found)

## Environment Configuration

**Required env vars:**
- `DATABASE_URI` - MongoDB connection string
- `PAYLOAD_SECRET` - Secret for Payload CMS session encryption
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- `NEXT_PUBLIC_APP_URL` - Application URL (e.g., http://localhost:3000)
- `NEXT_PUBLIC_ROOT_DOMAIN` - Root domain for multi-tenant subdomain routing (e.g., localhost:3000)
- `NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING` - Feature flag for subdomain routing (true/false)

**Secrets location:**
- `.env` file (development)
- Environment variables (production/CI systems)
- Example template: `.env.example`

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint: `POST /api/stripe/webhooks`
  - Handler: `src/app/(app)/api/stripe/webhooks/route.ts`
  - Events handled:
    - `checkout.session.completed` - Create order when payment completes
    - `account.updated` - Update tenant Stripe details

**Outgoing:**
- None detected

## Multi-Tenant Architecture

**Tenant Routing:**
- Subdomain-based routing via middleware: `src/middleware.ts`
- Matcher pattern: `*.{rootDomain}` (e.g., antonio.ferment.com)
- Rewrite to: `/tenants/{slug}` internal route
- Toggle: `NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING`

**Multi-Tenant Data Isolation:**
- Plugin: @payloadcms/plugin-multi-tenant v3.34.0
- Collections isolated by tenant:
  - Products
  - Media
- Super admin access via `isSuperAdmin()` check: `src/lib/access.ts`
- Tenant field array: tenantsArrayField configuration

## API Endpoints

**tRPC Routers:**
- Base URL: `/api/trpc/[procedure]`
- Routers: `src/trpc/routers/_app.ts`
  - auth - Authentication procedures
  - tags - Tag management
  - tenants - Tenant management
  - reviews - Product reviews
  - library - User library/orders
  - checkout - Cart and checkout operations
  - products - Product listing/search
  - categories - Category management

**Payload CMS APIs:**
- GraphQL endpoint: `/api/graphql`
- GraphQL playground: `/api/graphql-playground` (for development)
- REST API: `/api/[...slug]` (Payload REST API)
- Admin panel: `/admin`

## External Redirect

**Stripe Connect:**
- Stripe account creation/management for vendors (tenants)
- Account ID stored in Tenants collection: `stripeAccountId` field
- Details submission tracking: `stripeDetailsSubmitted` boolean field

---

*Integration audit: 2026-02-23*

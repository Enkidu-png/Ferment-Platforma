# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
src/
├── app/                           # Next.js App Router pages and API routes
│   ├── (app)/                     # Main application route group
│   │   ├── (auth)/                # Authentication pages (sign-in, sign-up)
│   │   ├── (home)/                # Public marketplace (home, categories, products)
│   │   ├── (library)/             # User library/purchases
│   │   ├── (tenants)/             # Tenant-specific stores and checkout
│   │   └── api/                   # API endpoints (tRPC, Stripe webhooks)
│   ├── (payload)/                 # Payload CMS admin interface
│   │   ├── admin/                 # Payload admin dashboard
│   │   └── api/                   # Payload GraphQL and REST API
│   ├── my-route/                  # Demo/utility route
│   └── layout.tsx                 # Root layout wrapper
├── collections/                   # Payload CMS collection definitions
│   ├── Users.ts
│   ├── Products.ts
│   ├── Categories.ts
│   ├── Tenants.ts
│   ├── Orders.ts
│   ├── Reviews.ts
│   ├── Tags.ts
│   └── Media.ts
├── modules/                       # Feature-based modules (co-located logic)
│   ├── auth/                      # Authentication module
│   │   ├── server/
│   │   │   └── procedures.ts      # Auth tRPC procedures (register, login, session)
│   │   ├── ui/
│   │   │   └── views/             # Auth page components
│   │   ├── schemas.ts             # Zod validation schemas
│   │   └── utils.ts               # Auth utilities (cookie generation, etc)
│   ├── products/                  # Products module
│   │   ├── server/
│   │   │   └── procedures.ts      # Product tRPC procedures (getOne, getMany)
│   │   ├── ui/
│   │   │   ├── components/        # Product display components
│   │   │   └── views/             # Product list/detail page views
│   │   ├── hooks/                 # Product-related React hooks
│   │   ├── search-params.ts       # URL search parameter handling
│   │   └── types.ts               # Product-related TypeScript types
│   ├── categories/                # Categories module
│   │   ├── server/
│   │   │   └── procedures.ts      # Category tRPC procedures
│   │   ├── types.ts
│   │   └── ui/
│   ├── checkout/                  # Shopping cart and checkout
│   │   ├── server/
│   │   │   └── procedures.ts      # Checkout procedures (verify, purchase)
│   │   ├── ui/
│   │   │   ├── components/        # Cart sidebar, checkout button
│   │   │   └── views/             # Checkout page view
│   │   ├── store/
│   │   │   └── use-cart-store.ts  # Zustand cart store (localStorage persisted)
│   │   ├── hooks/
│   │   │   └── use-cart.ts        # useCart hook
│   │   ├── types.ts               # Checkout/cart types
│   │   └── constants.ts
│   ├── tenants/                   # Store/tenant management
│   │   ├── server/
│   │   │   └── procedures.ts      # Tenant queries
│   │   └── ui/
│   │       └── components/        # Tenant-specific components
│   ├── library/                   # User's purchased items library
│   │   ├── server/
│   │   │   └── procedures.ts      # Library queries
│   │   └── ui/
│   │       └── views/             # Library page views
│   ├── reviews/                   # Product reviews
│   │   ├── server/
│   │   │   └── procedures.ts      # Review procedures
│   │   ├── types.ts
│   │   └── ui/
│   ├── tags/                      # Product tags
│   │   ├── server/
│   │   │   └── procedures.ts      # Tag queries
│   │   └── types.ts
│   ├── home/                      # Homepage/landing
│   │   ├── ui/
│   │   │   └── components/        # Landing page components
│   │   └── constants.ts           # Constants used on home
│   └── [other modules]/           # Similar structure for new modules
├── components/                    # Global/shared UI components
│   ├── ui/                        # Radix UI component library
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── [30+ Radix components]
│   ├── star-rating.tsx            # Star rating component
│   ├── star-picker.tsx            # Star picker for reviews
│   └── stripe-verify.tsx          # Stripe verification status component
├── trpc/                          # tRPC configuration and client setup
│   ├── init.ts                    # tRPC context, procedures (baseProcedure, protectedProcedure)
│   ├── routers/
│   │   └── _app.ts                # Root router combining all module routers
│   ├── server.tsx                 # Server-side tRPC client (SSR prefetch)
│   ├── client.tsx                 # Client-side tRPC client (browser)
│   └── query-client.ts            # React Query client configuration
├── lib/                           # Shared utilities
│   ├── access.ts                  # Authorization helpers (isSuperAdmin)
│   ├── stripe.ts                  # Stripe SDK instance
│   └── utils.ts                   # General utilities
├── hooks/                         # Global custom hooks
│   └── use-mobile.ts              # Mobile viewport detection hook
├── payload.config.ts              # Payload CMS configuration
├── middleware.ts                  # Next.js middleware (tenant routing)
├── constants.ts                   # Global constants (DEFAULT_LIMIT, PLATFORM_FEE_PERCENTAGE)
├── payload-types.ts               # Auto-generated Payload TypeScript types
├── seed.ts                        # Database seeding script
└── [other files]
```

## Directory Purposes

**`src/app`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Route groups, page components, API endpoints
- Key files: Layout wrappers, page components for each feature

**`src/collections`:**
- Purpose: Database schema definitions with Payload CMS
- Contains: Collection definitions with field configurations, access control, hooks
- Key files: `Users.ts`, `Products.ts`, `Tenants.ts`, `Orders.ts`

**`src/modules`:**
- Purpose: Feature-based code organization (auth, products, checkout, etc.)
- Contains: tRPC procedures, React components, client stores, types, utilities
- Pattern: Each module is self-contained with `server/` (backend), `ui/` (frontend), `hooks/`, `types.ts`

**`src/trpc`:**
- Purpose: tRPC setup and router configuration
- Contains: Procedure definitions, context setup, client/server initialization
- Key files: `init.ts` (core procedures), `routers/_app.ts` (root router)

**`src/components/ui`:**
- Purpose: Radix UI component library (headless UI components)
- Contains: Styled button, dialog, card, select, etc. components
- Pattern: Exported from shadcn/ui library

**`src/lib`:**
- Purpose: Shared utility functions and configurations
- Contains: Authorization helpers, Stripe SDK, general utilities
- Key files: `access.ts`, `stripe.ts`, `utils.ts`

**`src/hooks`:**
- Purpose: Global React hooks
- Contains: Reusable hooks (mobile detection, etc.)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with React Query provider wrapper
- `src/app/(app)/(home)/page.tsx`: Homepage/marketplace landing
- `src/app/(payload)/admin/[[...segments]]/page.tsx`: Payload admin dashboard

**Configuration:**
- `src/payload.config.ts`: Payload CMS setup (collections, db, plugins)
- `src/middleware.ts`: Next.js middleware for multi-tenant routing
- `src/trpc/init.ts`: tRPC context and procedure initialization
- `next.config.ts`: Next.js configuration with Payload integration
- `tsconfig.json`: TypeScript with path aliases (@/*, @payload-config)

**Core Logic:**
- `src/modules/*/server/procedures.ts`: tRPC business logic per feature
- `src/collections/*.ts`: Database schema and access control
- `src/lib/stripe.ts`: Stripe SDK instance
- `src/app/(app)/api/stripe/webhooks/route.ts`: Stripe event processing
- `src/app/(app)/api/trpc/[trpc]/route.ts`: tRPC HTTP handler

**State Management:**
- `src/modules/checkout/store/use-cart-store.ts`: Zustand cart store
- `src/trpc/query-client.ts`: React Query configuration

**Utilities:**
- `src/lib/access.ts`: Authorization check functions
- `src/constants.ts`: Global constants
- `src/payload-types.ts`: Auto-generated types from Payload schema

## Naming Conventions

**Files:**
- Pages: `page.tsx` (not `index.tsx`)
- API routes: `route.ts` (HTTP handler)
- Procedures: `procedures.ts` (tRPC routers)
- Collections: PascalCase (e.g., `Users.ts`, `Products.ts`)
- Components: `kebab-case.tsx` (e.g., `star-rating.tsx`, `checkout-button.tsx`)
- Stores: `use-*-store.ts` (e.g., `use-cart-store.ts`)
- Hooks: `use-*.ts` (e.g., `use-mobile.ts`, `use-cart.ts`)
- Schemas/Types: `types.ts`, `schemas.ts`, `search-params.ts`

**Directories:**
- Route groups: `(group-name)` - don't add to URL path
- Dynamic routes: `[paramName]` (e.g., `[category]`, `[slug]`)
- Spread routes: `[...segments]` (e.g., admin catchall)
- Feature modules: lowercase (e.g., `checkout`, `products`, `tenants`)
- Component subdirs: `ui/` (components), `server/` (tRPC), `store/` (Zustand), `hooks/`, `ui/views/`, `ui/components/`

## Where to Add New Code

**New Feature/Module:**
- Create `src/modules/[feature-name]/` directory
- Create `src/modules/[feature-name]/server/procedures.ts` for tRPC routes
- Create `src/modules/[feature-name]/ui/views/` for page components
- Create `src/modules/[feature-name]/ui/components/` for reusable components
- Create `src/modules/[feature-name]/types.ts` for TypeScript types
- Create `src/modules/[feature-name]/schemas.ts` for Zod validation (if needed)
- Create `src/modules/[feature-name]/store/` for Zustand stores (if needed)
- Import router in `src/trpc/routers/_app.ts` and add to `createTRPCRouter`

**New Page:**
- Create `src/app/(app)/(route-group)/[page-name]/page.tsx`
- Follow pattern: Prefetch data with `trpc` server call, dehydrate with React Query, render view component
- For dynamic routes: accept `params: Promise<{paramName: string}>` and `searchParams: Promise<SearchParams>`
- Set `export const dynamic = "force-dynamic"` if page depends on dynamic data

**New Component:**
- If global/shared: `src/components/[name].tsx`
- If module-specific: `src/modules/[module]/ui/components/[name].tsx`
- Follow naming: kebab-case filename, export default component
- Use TypeScript, accept typed props, document with JSDoc if complex

**New Collection:**
- Create `src/collections/[CollectionName].ts`
- Export `CollectionConfig` with fields and access control
- Import in `src/payload.config.ts` and add to `collections` array
- Run `bun run generate:types` to regenerate `payload-types.ts`

**Shared Utilities:**
- If pure function: `src/lib/[utility-name].ts`
- If React hook: `src/hooks/use-[name].ts`
- If Zustand store: `src/modules/[module]/store/use-[name]-store.ts`

## Special Directories

**`src/app/(payload)/`:**
- Purpose: Payload CMS admin interface (separate route group)
- Generated: Partially (admin UI rendered by Payload)
- Committed: Yes, contains custom admin components and layout wrappers

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (during `next build`)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via `bun install` or `npm install`)
- Committed: No (in .gitignore)

**`.env`:**
- Purpose: Environment variables (secrets, API keys)
- Generated: No (manual creation)
- Committed: No (in .gitignore) - use `.env.example` as template

---

*Structure analysis: 2026-02-23*

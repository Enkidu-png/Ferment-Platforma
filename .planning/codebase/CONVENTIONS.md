# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- PascalCase for collection/schema files: `Categories.ts`, `Products.ts`, `Users.ts`
- camelCase for utility/helper files: `stripe.ts`, `access.ts`, `utils.ts`
- kebab-case for component files: `star-rating.tsx`, `stripe-verify.tsx`, `use-mobile.ts`
- kebab-case for route segments and directories: `[slug]`, `(auth)`, `(home)`, `(library)`

**Functions:**
- camelCase for all exported functions: `useIsMobile()`, `isSuperAdmin()`, `generateTenantURL()`, `formatCurrency()`
- camelCase for internal/private functions and handlers
- React hooks prefixed with `use`: `useIsMobile()`, standard React pattern

**Variables:**
- camelCase for all variable declarations: `adminAccount`, `parentCategory`, `ratingDistribution`
- UPPER_SNAKE_CASE for constants: `DEFAULT_LIMIT`, `PLATFORM_FEE_PERCENTAGE`, `MAX_RATING`, `MIN_RATING`, `MOBILE_BREAKPOINT`

**Types:**
- PascalCase for all TypeScript types and interfaces: `StarRatingProps`, `CollectionConfig`, `TRPCError`, `Media`, `Tenant`, `Category`
- Suffix with `Props` for React component prop types: `StarRatingProps`

## Code Style

**Formatting:**
- ESLint with Next.js config (ESLint 9)
- Config file: `eslint.config.mjs` (flat config format)
- Uses ESLint recommended Next.js and TypeScript rules via `next/core-web-vitals` and `next/typescript`
- No Prettier config found - formatting handled by ESLint only

**Linting:**
- Tool: ESLint 9 with flat config
- Configuration: `eslint.config.mjs`
- Rules enforced: Next.js core web vitals and TypeScript strict mode
- TypeScript strict mode enabled in `tsconfig.json` with `strict: true`
- Additional checks: `noUncheckedIndexedAccess: true`

## Import Organization

**Order:**
1. External packages: `import { getPayload } from "payload"`
2. Internal path aliases: `import { Categories } from "@/collections/Categories"`
3. Type imports: `import type { CollectionConfig } from "payload"`
4. Local relative imports (rarely used due to path aliases)

**Path Aliases:**
- `@/*` → `./src/*` - primary alias for all source code
- `@payload-config` → `./src/payload.config.ts` - specific Payload CMS config

**Pattern in files:**
```typescript
import { getPayload } from "payload";
import config from "@payload-config";
import { stripe } from "./lib/stripe";  // relative for sibling modules
import { isSuperAdmin } from "@/lib/access";  // @ alias for cross-module imports
```

## Error Handling

**Patterns:**
- TRPC procedures throw `TRPCError` with specific codes: `"NOT_FOUND"`, `"UNAUTHORIZED"`
- Error codes follow TRPC standard: `code: "NOT_FOUND"`, `message: "Product not found"`
- Conditional checks for null/archived states throw errors rather than returning null
- Example in `src/modules/products/server/procedures.ts`:
  ```typescript
  if (product.isArchived) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Product not found",
    })
  }
  ```
- Client-side error handling: simple error boundary in `src/app/(app)/(tenants)/tenants/[slug]/(home)/products/[productId]/error.tsx`
- Async/await with try-catch in seed operations: `src/seed.ts` uses top-level try-catch with `process.exit()`

## Logging

**Framework:** Console (via `console.log()`, `console.error()`)

**Patterns:**
- Used in seed/initialization scripts: `console.log('Seeding completed successfully')`
- Used in error scenarios: `console.error('Error during seeding:', error)`
- No structured logging framework detected
- Logs appear only in setup/initialization code, not in main application logic

## Comments

**When to Comment:**
- Explain business logic and non-obvious decisions
- Clarify complex filter queries: `// If we are loading products for public storefront (no tenantSlug)`
- Document Next.js/framework-specific patterns: `// Load the "product.image", "product.tenant", and "product.tenant.image"`
- Middleware configuration: `/* Match all paths except for: 1. /api routes 2. /_next ...*/`

**JSDoc/TSDoc:**
- Not extensively used throughout the codebase
- Seen in TRPC configuration with links: `@see: https://trpc.io/docs/server/context`
- Generally minimal documentation, relying on type inference and clear naming

## Function Design

**Size:** Functions are compact and focused
- Procedures are typically 50-100 lines for query handlers
- Utility functions are single-purpose: `cn()` just merges Tailwind classes, `formatCurrency()` formats one value
- Component functions are concise: `StarRating` is ~38 lines

**Parameters:**
- Object destructuring preferred: `{ rating, className, iconClassName, text }`
- TRPC procedures use input validation with Zod: `z.object({ id: z.string() })`
- Functions accept a single options object rather than multiple positional parameters

**Return Values:**
- React components return JSX elements
- Utility functions return values directly: `string`, `number`, `object`
- TRPC queries return data objects with calculated/transformed fields
- Procedures return flattened/enriched data: combines database results with computed values

## Module Design

**Exports:**
- Named exports used consistently: `export const isSuperAdmin = ...`
- Export objects for configurations: `export const Categories: CollectionConfig = { ... }`
- Re-export patterns in TRPC: `export const createTRPCRouter`, `export const baseProcedure`
- Type exports: `export type AppRouter = typeof appRouter`

**Barrel Files:**
- Minimal use of barrel files detected
- Main router aggregates sub-routers: `src/trpc/routers/_app.ts` imports and combines all module routers
- Collection configurations are individual files, not aggregated

**Module Structure:**
- Feature-based organization under `src/modules/`
- Each module contains: `server/`, `ui/`, `hooks/`, `types.ts`, `search-params.ts`
- Collections in dedicated `src/collections/` directory
- TRPC infrastructure centralized in `src/trpc/`

## Type Safety

**TypeScript Configuration:**
- Target: ES2017
- Strict mode enabled: `strict: true`
- Additional strict checks: `noUncheckedIndexedAccess: true`
- JSX preserved (handled by Next.js)
- Module resolution: `bundler`

**Type Inference:**
- TRPC types inferred from router: `inferRouterOutputs<AppRouter>["products"]["getMany"]`
- Payload types auto-generated: `src/payload-types.ts`
- Component prop types explicitly defined: `interface StarRatingProps { ... }`

## Code Patterns

**Zod Validation:**
- Used for TRPC input validation in all procedures
- Inline schema definition: `.input(z.object({ id: z.string() }))`
- Default values provided: `z.number().default(DEFAULT_LIMIT)`
- Nullable/optional fields: `z.string().nullable().optional()`

**Class Utilities:**
- `cn()` utility for Tailwind class merging in `src/lib/utils.ts`
- Pattern: `cn("base-class", condition && "conditional-class", className)`
- Used throughout components for conditional styling

**Data Fetching:**
- Payload CMS used as database abstraction layer
- TRPC for type-safe client-server communication
- Procedures use context-based payload instance: `ctx.db.find()`, `ctx.db.findByID()`
- Depth parameter controls relationship population: `depth: 2` loads nested relations

**Array/List Operations:**
- `Array.from({ length: MAX_RATING }).map()` for creating fixed-length arrays
- `Promise.all()` for concurrent async operations
- Reduce for aggregations: `.reduce((acc, review) => acc + review.rating, 0)`
- `Object.keys()` for iterating record properties

---

*Convention analysis: 2026-02-23*

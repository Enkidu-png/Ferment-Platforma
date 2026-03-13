# Phase 4: API Layer Migration — Research

**Researched:** 2026-03-06
**Domain:** tRPC procedure rewrites + Payload CMS removal + Supabase query builder
**Confidence:** HIGH — full codebase read; all procedure files, schema, webhook, and access control examined directly

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | Products tRPC router rewritten to use Supabase client | Full procedure inventory below; all Payload calls mapped to Supabase equivalents |
| API-02 | Auth tRPC router rewritten to use Supabase Auth | Already done in Phase 2 — `authRouter` only returns `ctx.user`; no Payload remaining |
| API-03 | Tenants tRPC router rewritten to use Supabase client | Single `getOne` query by slug — direct `supabase.from("tenants")` replacement |
| API-04 | Orders tRPC router rewritten to use Supabase client | No dedicated orders router exists; orders are queried inside library and checkout procedures |
| API-05 | Checkout tRPC router and Stripe webhook handler updated for UUID format | `checkout.verify` uses Payload user lookup — must use `user_tenants` join table instead; webhook uses `payload.findByID` — must be removed |
| API-06 | Categories and Tags tRPC routers rewritten to use Supabase client | Both routers fully mapped; categories require recursive parent/child query |
| API-07 | All user-facing procedures use anon client (RLS enforced); Stripe webhook uses service-role client | `supabaseAdmin` singleton already exists in `src/lib/supabase/admin.ts` — ready to use in webhook |
</phase_requirements>

---

## Summary

Phase 4 is a complete, surgical rewrite of all tRPC procedures from Payload CMS (`ctx.db.*`) to the Supabase query builder (`ctx.supabase.from(...)`). The scope is larger than the seven routers suggest because `isSuperAdmin`, the Stripe webhook, and the `ctx.db` import in `src/trpc/init.ts` all carry Payload dependencies that must be eliminated in the same pass.

The Supabase schema is fully populated and typed (`src/lib/supabase/types.ts`). The `supabaseAdmin` service-role client already exists. The auth context (`ctx.user`, `ctx.supabase`) is already wired. The missing piece is exclusively the data-fetch layer — every `ctx.db.find` / `ctx.db.findByID` / `ctx.db.create` / `ctx.db.update` call must become a `ctx.supabase.from(...)` call.

**Primary recommendation:** Rewrite routers one at a time in dependency order (categories → tags → tenants → products → reviews → library → checkout → webhook). Remove `ctx.db` from `src/trpc/init.ts` only after all procedures are rewritten. Remove Payload entirely at the end of this phase.

---

## Current State Assessment

### What works
- Supabase auth: `ctx.user` (Supabase `User` type) is available in all procedures via `protectedProcedure`
- `ctx.supabase` (anon RLS-enforced client) and `supabaseAdmin` (service-role) are both ready
- `auth/confirm` route creates tenants and `user_tenants` rows in Supabase correctly
- Supabase schema has all tables seeded with 20 products, 41 categories, 3 tenants, 4 users
- `authRouter.session` (API-02) already returns `ctx.user` — no Payload call — already done

### What is broken
- Every tRPC procedure (`products`, `tenants`, `categories`, `tags`, `library`, `reviews`, `checkout`) uses `ctx.db` (Payload local API)
- `ctx.db` is still instantiated in `src/trpc/init.ts` via `getPayload({ config: configPromise })`
- The Stripe webhook uses `payload.findByID({ collection: "users" })` and `payload.create/update` for orders and tenants
- `isSuperAdmin` in `src/lib/access.ts` reads `user.roles` (Payload User type) — breaks without Payload users
- `src/seed.ts` imports from payload/`@payload-config` — will need a Supabase-only rewrite (already seeded; seed is not runtime code)
- `src/app/my-route/route.ts` is a leftover debug route using Payload — can be deleted
- `subcategory-menu.tsx` imports `Category` from `@/payload-types` — needs replacement with plain type

### Payload files that are app infrastructure (not to delete yet)
- `src/payload.config.ts` + all `src/collections/*.ts` — Payload admin still runs; deleted in Phase 7
- `src/app/(payload)/` route group — Payload admin UI; deleted in Phase 7

---

## tRPC Procedure Inventory

### Router: auth (`src/modules/auth/server/procedures.ts`)
**Status: Already complete — no Payload calls**
- `session` — returns `{ user: ctx.user ?? null }` — already Supabase

### Router: categories (`src/modules/categories/server/procedures.ts`)
**Status: All Payload — must rewrite**

| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "categories", depth: 1, where: { parent: { exists: false } } })` | `ctx.supabase.from("categories").select("*, subcategories:categories!parent_id(*)").is("parent_id", null)` |

**Key mapping details:**
- Payload `parent: { exists: false }` → Supabase `.is("parent_id", null)`
- Payload `depth: 1` (populate subcategories) → Supabase nested select via FK: `categories!parent_id(*)`
- The `Category` type imported from `@/payload-types` must be replaced with `Tables<"categories">` from `@/lib/supabase/types`
- Custom sort order logic (all → clothes → jewelery → ...) is pure JS — keep it unchanged

**Output shape change:**
- Payload: `doc.subcategories.docs[]` (paginated) → Supabase: `doc.subcategories[]` (plain array from join)
- The existing `(doc.subcategories?.docs ?? [])` access pattern must change to `(doc.subcategories ?? [])`

### Router: tags (`src/modules/tags/server/procedures.ts`)
**Status: All Payload — must rewrite**

| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "tags", page, limit })` | `ctx.supabase.from("tags").select("*").range(offset, offset + limit - 1)` |

**Key mapping details:**
- Payload `page` + `limit` → Supabase `.range(from, to)` where `from = (page-1)*limit`, `to = from+limit-1`
- Return shape: Payload returns `{ docs, totalDocs, page, limit, ... }` — must construct equivalent or change callers
- Tags table is currently empty; this is a simple query with no joins

### Router: tenants (`src/modules/tenants/server/procedures.ts`)
**Status: All Payload — must rewrite**

| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "tenants", depth: 1, where: { slug: { equals: input.slug } }, limit: 1 })` | `ctx.supabase.from("tenants").select("*, image:media(*)").eq("slug", input.slug).maybeSingle()` |

**Key mapping details:**
- Payload `depth: 1` populates `tenant.image` (Media) → Supabase join: `.select("*, image:media(*)")` using `image_id` FK
- Return type `Tenant & { image: Media | null }` → replace with Supabase type + nested media type
- `maybeSingle()` returns `null` (not an empty array) — throw `NOT_FOUND` when null

### Router: products (`src/modules/products/server/procedures.ts`)
**Status: All Payload — must rewrite (most complex)**

#### `products.getOne`
| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.findByID({ collection: "products", id, depth: 2, select: { content: false } })` | `ctx.supabase.from("products").select("id, name, description, price, is_archived, is_private, refund_policy, image:media!image_id(*), tenant:tenants!tenant_id(*, image:media!image_id(*)), category:categories!category_id(*)").eq("id", input.id).single()` |
| `ctx.db.find({ collection: "orders", where: { product: equals, user: equals } })` | `ctx.supabase.from("orders").select("id").eq("product_id", input.id).eq("user_id", ctx.user.id).maybeSingle()` |
| `ctx.db.find({ collection: "reviews", where: { product: equals } })` | `ctx.supabase.from("reviews").select("rating").eq("product_id", input.id)` |

**Note:** `content` exclusion (`select: { content: false }`) → simply omit `content` from the select string.

#### `products.getMany`
| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "categories", where: { slug: equals }, depth: 1 })` | `ctx.supabase.from("categories").select("slug, subcategories:categories!parent_id(slug)").eq("slug", input.category).maybeSingle()` |
| `ctx.db.find({ collection: "products", where, sort, page, limit })` | `ctx.supabase.from("products").select("...").eq/gte/lte/ilike/in().range().order()` |
| `ctx.db.find({ collection: "reviews", where: { product: equals } })` for each product | `ctx.supabase.from("reviews").select("rating").eq("product_id", doc.id)` (N+1 — acceptable for now) |

**Filter mapping table:**
| Payload `where` clause | Supabase equivalent |
|----------------------|---------------------|
| `isArchived: { not_equals: true }` | `.eq("is_archived", false)` |
| `isPrivate: { not_equals: true }` | `.eq("is_private", false)` |
| `"tenant.slug": { equals: slug }` | Join tenants in select and filter: `tenants!tenant_id(slug)` then use RPC or subquery — simpler: fetch tenant_id first by slug, then `.eq("tenant_id", tenantId)` |
| `price: { greater_than_equal: min }` | `.gte("price", min)` |
| `price: { less_than_equal: max }` | `.lte("price", max)` |
| `"category.slug": { in: [...] }` | Join + filter — simpler: fetch category IDs by slugs, then `.in("category_id", categoryIds)` |
| `"tags.name": { in: [...] }` | Join via product_tags — use Supabase filter with join or subquery |
| `name: { like: search }` | `.ilike("name", `%${search}%`)` |

**Sort mapping:**
| Payload `sort` | Supabase equivalent |
|---------------|---------------------|
| `-createdAt` (default) | `.order("created_at", { ascending: false })` |
| `+createdAt` | `.order("created_at", { ascending: true })` |

**Pagination:**
- Payload `page` + `limit` → Supabase `.range((page-1)*limit, page*limit - 1)`

#### `products.getMany` — tenant slug filter approach
The cleanest approach for `tenantSlug` filtering:
1. Fetch tenant UUID: `ctx.supabase.from("tenants").select("id").eq("slug", tenantSlug).single()`
2. Then `.eq("tenant_id", tenant.id)` on the products query
This avoids complex join-based filters and stays readable.

#### `products.getMany` — category filter approach
For category + subcategory filtering:
1. Fetch category and its children: `ctx.supabase.from("categories").select("id, subcategories:categories!parent_id(id)").eq("slug", slug).single()`
2. Collect all category IDs: `[parent.id, ...parent.subcategories.map(s => s.id)]`
3. `.in("category_id", categoryIds)` on products

#### `products.getMany` — tag filter approach
Tags are in `product_tags` join table. Options:
- Filter via Supabase join: `ctx.supabase.from("products").select("*, product_tags!inner(tag_id, tags!inner(name))")` then filter — complex
- Simpler: fetch tag IDs first from tag names, then filter product_tags for products containing those tag IDs using a raw in() filter
- Recommended: `.in("id", productIdsFromTagFilter)` — do a preliminary `product_tags` query

### Router: reviews (`src/modules/reviews/server/procedures.ts`)
**Status: All Payload — must rewrite**

| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.findByID({ collection: "products", id })` | `ctx.supabase.from("products").select("id").eq("id", id).maybeSingle()` |
| `ctx.db.find({ collection: "reviews", where: { product, user } })` | `ctx.supabase.from("reviews").select("*").eq("product_id", productId).eq("user_id", ctx.user.id).maybeSingle()` |
| `ctx.db.create({ collection: "reviews", data: { user, product, rating, description } })` | `ctx.supabase.from("reviews").insert({ user_id: ctx.user.id, product_id, rating, description }).select().single()` |
| `ctx.db.findByID({ collection: "reviews", id, depth: 0 })` | `ctx.supabase.from("reviews").select("*").eq("id", id).single()` |
| `ctx.db.update({ collection: "reviews", id, data: { rating, description } })` | `ctx.supabase.from("reviews").update({ rating, description }).eq("id", id).select().single()` |

**Auth guard for update:** Current code checks `existingReview.user !== ctx.user.id`. In Supabase: `existingReview.user_id !== ctx.user.id`. RLS also enforces this — but the application-level check is good defensive programming; keep it.

**IMPORTANT — reviews RLS:** The `reviews` table has RLS. The anon client (ctx.supabase) can read reviews (public browse). The `create` and `update` must pass through the authenticated user's Supabase client (which carries the JWT) — this works because `ctx.supabase` is created from the user's session cookies.

### Router: library (`src/modules/library/server/procedures.ts`)
**Status: All Payload — must rewrite**

| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "orders", where: { product, user } })` | `ctx.supabase.from("orders").select("id").eq("product_id", productId).eq("user_id", ctx.user.id).maybeSingle()` |
| `ctx.db.findByID({ collection: "products", id })` | `ctx.supabase.from("products").select("*").eq("id", id).single()` |
| `ctx.db.find({ collection: "orders", depth: 0, page, limit, where: { user: equals } })` | `ctx.supabase.from("orders").select("product_id").eq("user_id", ctx.user.id).range(from, to)` |
| `ctx.db.find({ collection: "products", where: { id: { in: productIds } } })` | `ctx.supabase.from("products").select("*, image:media!image_id(*), tenant:tenants!tenant_id(*)").in("id", productIds)` |
| `ctx.db.find({ collection: "reviews", where: { product: equals } })` per product | `ctx.supabase.from("reviews").select("rating").eq("product_id", id)` |

### Router: checkout (`src/modules/checkout/server/procedures.ts`)
**Status: Mixed — most critical migration**

#### `checkout.verify` — FULLY BROKEN FOR NEW USERS
Current: `ctx.db.findByID({ collection: "users", id: ctx.user.id })` then `ctx.db.findByID({ collection: "tenants", id: tenantId })`
Problem: New users have no Payload user record. This throws.

Replacement:
```typescript
// Step 1: get tenant_id from user_tenants join table
const { data: userTenant } = await ctx.supabase
  .from("user_tenants")
  .select("tenant_id")
  .eq("user_id", ctx.user.id)
  .maybeSingle();

// Step 2: get tenant's stripeAccountId
const { data: tenant } = await ctx.supabase
  .from("tenants")
  .select("stripe_account_id")
  .eq("id", userTenant.tenant_id)
  .single();

// Then: stripe.accountLinks.create({ account: tenant.stripe_account_id, ... })
```

#### `checkout.purchase` — needs tenant and product lookups replaced
| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "products", where: { id: in, "tenant.slug": equals, isArchived: false } })` | Fetch tenant_id by slug first, then `.in("id", productIds).eq("tenant_id", tenantId).eq("is_archived", false)` |
| `ctx.db.find({ collection: "tenants", where: { slug: equals } })` | `ctx.supabase.from("tenants").select("stripe_account_id, stripe_details_submitted").eq("slug", tenantSlug).single()` |

**Field name changes:** `tenant.stripeAccountId` → `tenant.stripe_account_id`; `tenant.stripeDetailsSubmitted` → `tenant.stripe_details_submitted`

#### `checkout.getProducts`
| Current Payload call | Supabase equivalent |
|---------------------|---------------------|
| `ctx.db.find({ collection: "products", depth: 2, where: { id: in, isArchived: false } })` | `ctx.supabase.from("products").select("*, image:media!image_id(*), tenant:tenants!tenant_id(*, image:media!image_id(*))").in("id", ids).eq("is_archived", false)` |

---

## Payload Removal Scope

### Files with `import ... from 'payload'` or `@payload-config` that must change in Phase 4

| File | What to change |
|------|----------------|
| `src/trpc/init.ts` | Remove `getPayload`, `configPromise`, `db` from context |
| `src/modules/products/server/procedures.ts` | Full rewrite |
| `src/modules/tenants/server/procedures.ts` | Full rewrite |
| `src/modules/categories/server/procedures.ts` | Full rewrite |
| `src/modules/tags/server/procedures.ts` | Full rewrite |
| `src/modules/reviews/server/procedures.ts` | Full rewrite |
| `src/modules/library/server/procedures.ts` | Full rewrite |
| `src/modules/checkout/server/procedures.ts` | Full rewrite |
| `src/app/(app)/api/stripe/webhooks/route.ts` | Remove `getPayload`; use `supabaseAdmin` |
| `src/lib/access.ts` | Rewrite `isSuperAdmin` to use Supabase `users.role` column |
| `src/modules/home/ui/components/search-filters/subcategory-menu.tsx` | Replace `Category` import from `@/payload-types` with plain type |
| `src/app/my-route/route.ts` | Delete entirely (debug route) |

### Files that stay (Payload infrastructure — deferred to Phase 7)

| File | Reason to keep |
|------|---------------|
| `src/payload.config.ts` | Payload admin still mounts |
| `src/collections/*.ts` (8 files) | Payload collection definitions |
| `src/app/(payload)/` route group | Payload admin UI routes |
| `src/seed.ts` | Already executed; harmless until Phase 7 cleanup |

### Payload packages in `package.json` (remove in Phase 7, not Phase 4)
- `payload` 3.34.0
- `@payloadcms/db-mongodb` 3.34.0
- `@payloadcms/next` 3.34.0
- `@payloadcms/payload-cloud` 3.34.0
- `@payloadcms/plugin-multi-tenant` 3.34.0
- `@payloadcms/richtext-lexical` 3.34.0
- `@payloadcms/storage-vercel-blob` 3.34.0

**Do not remove packages in Phase 4** — Payload admin at `/admin` must remain functional until Phase 6 custom admin UI is built and Phase 7 removes Payload entirely.

---

## isSuperAdmin Migration

### Current implementation (`src/lib/access.ts`)
```typescript
import { ClientUser } from "payload";
import type { User } from "@/payload-types";

export const isSuperAdmin = (user: User | ClientUser | null) => {
  return Boolean(user?.roles?.includes("super-admin"));
};
```

### Problem
- Used in Payload collection access control (`src/collections/*.ts`) — these need a Payload-compatible version
- Used in `src/payload.config.ts` for the multi-tenant plugin
- Phase 4 needs a Supabase-based version for tRPC procedures

### Solution: Two-track approach

**Track 1 — Supabase-based (for tRPC procedures):**
Create a new helper `src/lib/access-supabase.ts`:
```typescript
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";

// Use the Supabase DB users.role column
export const isSuperAdminSupabase = (dbUser: Tables<"users"> | null): boolean => {
  return dbUser?.role === "super-admin";
};
```

To use this in a tRPC procedure, the procedure needs to fetch the user's row from the `users` table:
```typescript
const { data: dbUser } = await ctx.supabase
  .from("users")
  .select("role")
  .eq("id", ctx.user.id)
  .single();
const isAdmin = dbUser?.role === "super-admin";
```

**Alternatively** — the Supabase DB already has an `is_super_admin()` SQL function (confirmed in `types.ts` Functions section). This function is available to call via RPC:
```typescript
const { data: isAdmin } = await ctx.supabase.rpc("is_super_admin");
```
This is the cleanest approach — the DB function reads from the JWT claim, which was set by the `custom_access_token_hook`.

**Track 2 — Payload-compatible (keep for collections):**
Leave `src/lib/access.ts` unchanged for Phase 4. The Payload collection files still reference it — they will be deleted in Phase 7 along with the rest of Payload. The only change needed is to stop tRPC procedures from calling the old `isSuperAdmin`.

**Phase 4 action:** No changes to `src/lib/access.ts`. For any tRPC procedure needing admin check, use `ctx.supabase.rpc("is_super_admin")`.

---

## Stripe Webhook Migration

### Current flow (`src/app/(app)/api/stripe/webhooks/route.ts`)

**`checkout.session.completed` event:**
1. `payload.findByID({ collection: "users", id: data.metadata.userId })` — validates user exists
2. Retrieves expanded session from Stripe
3. `payload.create({ collection: "orders", data: { stripeCheckoutSessionId, stripeAccountId, user: user.id, product: item.price.product.metadata.id, name } })`

**`account.updated` event:**
1. `payload.update({ collection: "tenants", where: { stripeAccountId: equals }, data: { stripeDetailsSubmitted } })`

### New flow

**`checkout.session.completed` event:**
```typescript
import { supabaseAdmin } from "@/lib/supabase/admin";

// Validate user exists in Supabase users table
const { data: dbUser } = await supabaseAdmin
  .from("users")
  .select("id")
  .eq("id", data.metadata.userId)
  .single();

if (!dbUser) throw new Error("User not found");

// Create order row (service-role bypasses RLS)
for (const item of lineItems) {
  await supabaseAdmin.from("orders").insert({
    stripe_checkout_session_id: data.id,
    stripe_account_id: event.account,
    user_id: data.metadata.userId,  // Already a Supabase UUID
    product_id: item.price.product.metadata.id,
  });
}
```

**`account.updated` event:**
```typescript
await supabaseAdmin
  .from("tenants")
  .update({ stripe_details_submitted: data.details_submitted })
  .eq("stripe_account_id", data.id);
```

### Key changes
- Remove `import { getPayload } from "payload"` and `import config from "@payload-config"` — the only Payload imports in the webhook
- `payload` variable → `supabaseAdmin` (already imported module-level singleton)
- `user.id` validation → query `users` table via `supabaseAdmin`
- Order insert: `user` (Payload relationship) → `user_id` (UUID text FK); `product` → `product_id`; drop `name` field (not in schema)
- Tenant update: `stripeAccountId` → `stripe_account_id`; `stripeDetailsSubmitted` → `stripe_details_submitted`

### Important: `orders.name` field
The Supabase `orders` table schema does NOT have a `name` column (confirmed in `types.ts`). The Payload `Orders` collection had a required `name: text` field. This is dropped in the Supabase schema — the insert in the webhook must NOT include it.

---

## Data Shape Changes

### Payload types → Supabase types

All `import { Category, Media, Tenant } from "@/payload-types"` imports must be replaced with types derived from the generated Supabase `Database` type:

```typescript
import type { Tables } from "@/lib/supabase/types";

type SupabaseProduct = Tables<"products">;
type SupabaseTenant = Tables<"tenants">;
type SupabaseCategory = Tables<"categories">;
type SupabaseMedia = Tables<"media">;
type SupabaseOrder = Tables<"orders">;
type SupabaseReview = Tables<"reviews">;
type SupabaseTag = Tables<"tags">;
```

### Naming convention changes

| Payload field name | Supabase column name |
|-------------------|---------------------|
| `isArchived` | `is_archived` |
| `isPrivate` | `is_private` |
| `stripeAccountId` | `stripe_account_id` |
| `stripeDetailsSubmitted` | `stripe_details_submitted` |
| `refundPolicy` | `refund_policy` |
| `image` (upload relationship) | `image_id` (FK); join as `image:media!image_id(*)` |
| `tenant` (relationship) | `tenant_id` (FK); join as `tenant:tenants!tenant_id(*)` |
| `category` (relationship) | `category_id` (FK); join as `category:categories!category_id(*)` |
| `user` (relationship) | `user_id` (FK text) |
| `product` (relationship) | `product_id` (FK text) |
| `parent` (relationship) | `parent_id` (FK); join as `subcategories:categories!parent_id(*)` |

### Paginated response shape

Payload returns `{ docs, totalDocs, page, limit, totalPages, hasNextPage, hasPrevPage }`.
Supabase does not return this automatically. Options:

1. **Count query + data query** — `ctx.supabase.from("products").select("*", { count: "exact" })` returns `{ data, count }`. Reconstruct pagination metadata.
2. **Match existing shape** — build a wrapper:
```typescript
const totalCount = count ?? 0;
return {
  docs: data,
  totalDocs: totalCount,
  page: input.cursor,
  limit: input.limit,
  totalPages: Math.ceil(totalCount / input.limit),
  hasNextPage: input.cursor * input.limit < totalCount,
  hasPrevPage: input.cursor > 1,
};
```

The callers (React Query hooks, UI components) depend on `docs`, `totalDocs`, and `hasNextPage` from the return value. The wrapper approach preserves backward compatibility without changing UI components.

### `subcategory-menu.tsx` — plain type
The component imports `Category` from `@/payload-types` only to type the `subcategory` in `.map((subcategory: Category) => ...)`. Replace with:
```typescript
import type { Tables } from "@/lib/supabase/types";
type Category = Tables<"categories">;
```
Or use `CategoriesGetManyOutput[number]["subcategories"][number]` from the inferred router output type.

---

## Architecture Patterns

### Supabase join syntax (Postgres-REST)

Supabase uses PostgREST foreign key join syntax in select strings:

```typescript
// One-to-one join via FK
.select("*, image:media!image_id(*)")
// Reverse join (children → parent)
.select("*, subcategories:categories!parent_id(*)")
// Nested join (product → tenant → tenant's image)
.select("*, tenant:tenants!tenant_id(*, image:media!image_id(*))")
```

When a table has multiple FKs to the same table, PostgREST requires the FK column name to disambiguate: `media!image_id(*)` vs `media!cover_id(*)`.

### Count queries

```typescript
const { data, count, error } = await ctx.supabase
  .from("products")
  .select("*", { count: "exact", head: false })
  .eq("is_archived", false)
  .range(from, to);
```

### Service-role vs anon client rule (API-07)

| Operation | Client | Reason |
|-----------|--------|--------|
| `products.getMany`, `products.getOne`, `tenants.getOne`, `categories.getMany`, `tags.getMany` | `ctx.supabase` (anon, RLS) | Public browsing — RLS scopes by tenant |
| `reviews.getOne`, `reviews.create`, `reviews.update` | `ctx.supabase` (authenticated anon, RLS) | User owns the review — RLS enforces `user_id = auth.uid()` |
| `library.getOne`, `library.getMany` | `ctx.supabase` (authenticated anon, RLS) | User owns the order |
| `checkout.verify`, `checkout.purchase`, `checkout.getProducts` | `ctx.supabase` (authenticated anon) | Authenticated procedures |
| Stripe webhook `checkout.session.completed` | `supabaseAdmin` (service-role) | Webhook is not an authenticated user request; needs to write orders |
| Stripe webhook `account.updated` | `supabaseAdmin` (service-role) | Update any tenant record |

---

## Common Pitfalls

### Pitfall 1: Supabase join ambiguity with multiple FKs to same table
**What goes wrong:** `products` has both `image_id` and `cover_id` FKs pointing to `media`. `SELECT *, image:media(*)` is ambiguous — PostgREST cannot infer which FK to use.
**How to avoid:** Always use the FK column name: `media!image_id(*)` and `media!cover_id(*)`.

### Pitfall 2: `.single()` throws on zero rows; `.maybeSingle()` returns null
**What goes wrong:** Using `.single()` when the row might not exist causes a PostgREST error (406 Not Acceptable), which Supabase surfaces as an error object, not a null.
**How to avoid:** Use `.maybeSingle()` for lookups where null is a valid state (e.g., `reviews.getOne`). Use `.single()` only when you are certain the row exists (e.g., after insert with `.select().single()`).

### Pitfall 3: RLS blocks webhook operations
**What goes wrong:** Using `ctx.supabase` (anon client) in the Stripe webhook cannot insert orders or update tenants because the webhook request has no auth cookie — RLS rejects all writes.
**How to avoid:** Stripe webhook MUST use `supabaseAdmin` (service-role client) for all reads and writes. `supabaseAdmin` is already available in `src/lib/supabase/admin.ts`.

### Pitfall 4: Pagination offset calculation
**What goes wrong:** Supabase `.range(from, to)` is zero-based and inclusive. Payload `page: 1, limit: 10` = first 10 records. Supabase equivalent: `.range(0, 9)`.
**Formula:** `from = (page - 1) * limit`, `to = from + limit - 1`.

### Pitfall 5: Payload richText fields
**What goes wrong:** Payload's `description` field on products is `type: "richText"` (Lexical editor JSON). In the Supabase schema, `description` is stored as `text | null`. The seeded data used plain strings. Rich text rendering (if any) in the UI may break.
**How to avoid:** Check UI components that render `product.description`. If they call a Payload Lexical renderer, replace with plain text rendering. Phase 4 scope is data layer only; if rich text UI is complex, note as a follow-up.

### Pitfall 6: `checkout.verify` currently broken for new users
**What goes wrong:** `checkout.verify` calls `ctx.db.findByID({ collection: "users", id: ctx.user.id })` — new users (Supabase auth only) have no Payload user record. The Payload call returns nothing, and the procedure throws.
**Impact:** Stripe onboarding is broken for any user created after Phase 2. This is the highest-priority bug in Phase 4.
**How to avoid:** Replace with `user_tenants` query as described in the Stripe webhook migration section.

### Pitfall 7: Products query filtering by tenant slug requires two-step lookup
**What goes wrong:** Supabase cannot filter on a joined table's column in the same query easily. `WHERE tenant.slug = ?` is not directly supported in PostgREST without a view or RPC.
**How to avoid:** Two-step: (1) fetch `tenant_id` by slug, (2) filter products by `tenant_id`. Add the tenant slug lookup inside the procedure before building the products query.

### Pitfall 8: `ctx.db` removal timing
**What goes wrong:** If `ctx.db` is removed from `src/trpc/init.ts` before all procedures are rewritten, TypeScript compilation fails everywhere `ctx.db` is referenced.
**How to avoid:** Remove `ctx.db` from context as the last step, after all 6 routers are rewritten and TypeScript compiles cleanly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=chromium --reporter=list` |
| Full suite command | `npx playwright test --reporter=list` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Products load on storefront subdomain; other tenants' products not returned | Playwright e2e | `npx playwright test -g "storefront" --reporter=list` | Wave 0 needed |
| API-02 | Auth session returns current user | Unit (tRPC caller) | manual / Wave 0 | Wave 0 needed |
| API-03 | Tenant storefront resolves by slug | Playwright e2e | existing smoke test covers subdomain | Partial |
| API-04 | Library returns only user's purchased products | Playwright e2e | `npx playwright test -g "library"` | Wave 0 needed |
| API-05 | Checkout.verify creates Stripe account link; webhook creates order row | Playwright e2e (Stripe test mode) | manual — Stripe webhooks require test env | Manual only |
| API-06 | Categories load with subcategories; tags load | Playwright e2e | existing smoke test covers category filter | Partial |
| API-07 | RLS: buyer cannot access another tenant's private products | Playwright e2e | `npx playwright test -g "rls"` | Wave 0 needed |

### Practical verification approach for each procedure rewrite

After each router rewrite, verify by:
1. Run TypeScript compiler: `npx tsc --noEmit`
2. Start dev server: `npm run dev`
3. Exercise the route manually via browser (categories appear, products load, tenant storefront works)
4. Run existing Playwright smoke tests: `npx playwright test --reporter=list`

### Wave 0 Gaps
- [ ] `tests/api-layer.spec.ts` — covers API-01 (storefront isolation), API-03 (tenant by slug), API-06 (categories with subcategories)
- [ ] `tests/library.spec.ts` — covers API-04 (library requires auth + purchase)
- [ ] `tests/rls.spec.ts` — covers API-07 (anon client cannot read private products from other tenants)

**Note:** Stripe webhook (API-05) cannot be fully automated in Playwright without Stripe CLI webhook forwarding. Mark as manual verification with `stripe trigger checkout.session.completed` using the Stripe CLI.

---

## Implementation Order

Recommended order minimizes breakage. Each step should compile and run before the next.

### Step 1: Rewrite `categoriesRouter` (no auth required, foundational for products)
- Replace `ctx.db.find` with `ctx.supabase.from("categories")`
- Fix subcategory join syntax
- Replace `Category` import from `@/payload-types` with `Tables<"categories">`
- Fix `docs` → plain array in subcategory access pattern

### Step 2: Rewrite `tagsRouter` (simple, no joins)
- Replace `ctx.db.find` with `ctx.supabase.from("tags")`
- Add pagination offset math

### Step 3: Rewrite `tenantsRouter` (needed by products and checkout)
- Replace `ctx.db.find` with `ctx.supabase.from("tenants")`
- Fix `Tenant & { image: Media | null }` return type

### Step 4: Rewrite `productsRouter` (most complex — depends on categories and tenants)
- `getOne`: replace all three Payload calls
- `getMany`: implement two-step tenant filter, two-step category filter, tag filter via product_tags
- Replace all `@/payload-types` imports

### Step 5: Rewrite `reviewsRouter` (depends on products)
- Replace all Payload calls
- Fix field names: `user` → `user_id`, `product` → `product_id`

### Step 6: Rewrite `libraryRouter` (depends on products and orders)
- Replace all Payload calls
- Fix field names throughout

### Step 7: Rewrite `checkoutRouter` (most critical — fixes the live bug)
- `checkout.verify`: implement `user_tenants` join approach
- `checkout.purchase`: two-step tenant lookup, fix field names
- `checkout.getProducts`: fix field names

### Step 8: Rewrite Stripe webhook
- Remove `getPayload` import
- Use `supabaseAdmin` for all database operations
- Fix order insert: remove `name`, use `user_id`, `product_id`
- Fix tenant update: use `stripe_account_id`, `stripe_details_submitted`

### Step 9: Clean up `src/trpc/init.ts`
- Remove `getPayload`, `configPromise`, `db`
- Verify TypeScript compiles with `npx tsc --noEmit`

### Step 10: Fix `subcategory-menu.tsx`
- Replace `Category` from `@/payload-types` with Supabase type

### Step 11: Delete `src/app/my-route/route.ts`
- Debug route with no production purpose

### Step 12: Run full Playwright suite
- `npx playwright test --reporter=list`
- Manually verify: sign in, browse categories, view product, storefront subdomain

---

## Risk Areas

### HIGH RISK: Category subcategory join in Supabase
The Supabase join `categories!parent_id(*)` is a self-referential join. PostgREST supports this, but the response nesting may differ from what the UI components expect. The existing code does `doc.subcategories?.docs ?? []` — the `docs` key does not exist in Supabase response. This will cause a silent empty array (not an error) unless caught. Check `SubcategoryMenu` and the categories procedure return value carefully.

### HIGH RISK: `checkout.verify` is broken for all new users right now
This is a live bug. New users registered via Supabase auth have no Payload record. The Stripe onboarding link cannot be generated. This must be the first functional fix even if it is not the first code change.

### MEDIUM RISK: Products `getMany` N+1 query for review ratings
The current code fetches reviews per-product in a `Promise.all` loop. In Supabase this is still N+1 (one query per product). For the current data volume (20 products) this is fine. For production scale, a single aggregation query would be needed. Flag as acceptable technical debt for Phase 4; note for Phase 6 optimization.

### MEDIUM RISK: Payload `description` field is richText; Supabase stores plain text
The Payload `Products` collection defines `description` as `type: "richText"` (Lexical). The Supabase seed inserted plain strings. If any UI component tries to render the Payload Lexical JSON format, it will now receive a plain string. Check product detail page rendering.

### LOW RISK: `Sort` and `Where` types from payload
`src/modules/products/server/procedures.ts` imports `Sort` and `Where` from `"payload"`. These are used to type local variables. After rewriting with Supabase query builder, these types are no longer needed — the variables become plain strings/objects. Remove the import.

### LOW RISK: `graphql` package in dependencies
`package.json` includes `"graphql": "^16.8.1"`. This was likely pulled in by Payload's GraphQL API. The `(payload)/api/graphql` route exists. This is not touched in Phase 4 — the graphql route stays with the rest of the Payload admin group until Phase 7.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/supabase/types.ts` — authoritative schema; all table columns and relationships verified directly
- `src/lib/supabase/admin.ts` — service-role client confirmed as singleton, ready to use
- `src/trpc/init.ts` — confirmed `ctx.db`, `ctx.supabase`, `ctx.user` shape
- All 8 `procedures.ts` files — exact Payload calls inventoried by reading source
- `src/app/(app)/api/stripe/webhooks/route.ts` — exact webhook implementation read
- `src/lib/access.ts` — exact `isSuperAdmin` implementation read
- `src/payload.config.ts` — full Payload plugin and collection list confirmed

### Secondary (MEDIUM confidence)
- Supabase PostgREST join syntax (`table!fk_column(*)`) — standard PostgREST feature, well-documented; verified pattern from Phase 1/2 work (Supabase client factory uses the same `@supabase/ssr` library)
- `is_super_admin()` RPC function — confirmed in `types.ts` Functions section; implementation in DB verified by the `custom_access_token_hook` which sets the JWT claim this function reads

### Tertiary (LOW confidence)
- None — all critical findings are sourced directly from the codebase

---

## Metadata

**Confidence breakdown:**
- Current state assessment: HIGH — all files read directly
- tRPC procedure inventory: HIGH — all procedures read, all Payload calls documented
- Payload removal scope: HIGH — grep confirmed all 28 affected files
- isSuperAdmin migration: HIGH — both the current implementation and the Supabase `is_super_admin` RPC confirmed in source
- Stripe webhook migration: HIGH — full webhook source read
- Data shape changes: HIGH — both `payload-types` usage and Supabase types confirmed

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (schema is stable; Supabase API is stable)

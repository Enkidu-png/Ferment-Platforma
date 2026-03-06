---
phase: 04-api-layer-migration
verified: 2026-03-06T17:30:00Z
status: passed
score: 22/22 must-haves verified
re_verification: false
---

# Phase 4: API Layer Migration — Verification Report

**Phase Goal:** Migrate all tRPC routers from Payload ORM (ctx.db) to Supabase (ctx.supabase), then remove Payload from the codebase entirely.
**Verified:** 2026-03-06T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ctx.db is removed from src/trpc/init.ts — no getPayload call at request time | VERIFIED | init.ts returns `{ supabase, user }` only; no payload imports |
| 2 | categoriesRouter uses ctx.supabase with PostgREST self-join categories!parent_id | VERIFIED | Line 12: `.select("*, subcategories:categories!parent_id(*)")` |
| 3 | tagsRouter paginates from Supabase — no ctx.db | VERIFIED | Line 18: `.from("tags").select("*", { count: "exact" }).range(from, to)` |
| 4 | tenantsRouter resolves by slug from Supabase with .maybeSingle() | VERIFIED | Line 23: `.eq("slug", input.slug).maybeSingle()` |
| 5 | subcategory-menu.tsx uses Supabase types — no @/payload-types import | VERIFIED | Uses `Tables<"categories">` at line 7; grep confirms no payload import |
| 6 | productsRouter.getMany uses two-step tenant filter (tenants table) | VERIFIED | Lines 131–148: `.from("tenants").select("id").eq("slug",...).single()` |
| 7 | productsRouter.getMany uses two-step category filter (categories!parent_id) | VERIFIED | Lines 165–178: `.select("id, subcategories:categories!parent_id(id)")` |
| 8 | productsRouter.getMany uses three-step tag filter (product_tags join) | VERIFIED | Lines 201–204: `.from("product_tags").select("product_id").in("tag_id", ...)` |
| 9 | productsRouter.getOne returns product with isPurchased and reviewRating | VERIFIED | Lines 50–97: orders query for isPurchased, reviews query for reviewRating |
| 10 | reviewsRouter.create uses user_id/product_id field names | VERIFIED | Lines 66–70: `insert({ user_id: ctx.user.id, product_id: input.productId, ... })` |
| 11 | reviewsRouter.update uses user_id ownership check | VERIFIED | Line 99: `existingReview.user_id !== ctx.user.id` |
| 12 | libraryRouter.getMany uses two-step orders → products pattern | VERIFIED | Lines 57–80: `.from("orders")` then `.from("products").in("id", productIds)` |
| 13 | checkout.verify queries user_tenants join table (not Payload users collection) | VERIFIED | Lines 17–21: `.from("user_tenants").select("tenant_id").eq("user_id", ctx.user.id)` |
| 14 | checkout.purchase uses snake_case field names (stripe_account_id) | VERIFIED | Lines 69, 77, 89: `stripe_account_id`, `stripe_details_submitted`, `tenant_id` |
| 15 | Stripe webhook uses supabaseAdmin for all DB operations | VERIFIED | 4 occurrences of `supabaseAdmin` in route.ts (users, orders x2, tenants) |
| 16 | Stripe webhook has no Payload imports (getPayload, @payload-config) | VERIFIED | Only imports: stripe, NextResponse, supabaseAdmin, ExpandedLineItem |
| 17 | src/payload.config.ts is deleted | VERIFIED | File does not exist — confirmed by filesystem check |
| 18 | src/collections/ directory is deleted | VERIFIED | Directory does not exist — confirmed by filesystem check |
| 19 | src/app/(payload)/ route group is deleted | VERIFIED | Directory does not exist — confirmed by filesystem check |
| 20 | src/app/my-route/ debug route is deleted | VERIFIED | File does not exist — confirmed by filesystem check |
| 21 | src/lib/access.ts is deleted | VERIFIED | File does not exist — confirmed by filesystem check |
| 22 | tests/smoke/rls-isolation.spec.ts created with load gate preventing vacuous passes | VERIFIED | Two tests: load gate waits for ceramics-by-ana product before asserting woodworks-jan absent |

**Score:** 22/22 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/trpc/init.ts` | tRPC context with supabase + user only | VERIFIED | Returns `{ supabase, user }`; contains `createClient` |
| `src/modules/categories/server/procedures.ts` | categoriesRouter using ctx.supabase | VERIFIED | `from("categories")` + self-join + no payload imports |
| `src/modules/tags/server/procedures.ts` | tagsRouter using ctx.supabase | VERIFIED | `from("tags")` with `.range()` pagination |
| `src/modules/tenants/server/procedures.ts` | tenantsRouter using ctx.supabase | VERIFIED | `from("tenants")` + `.maybeSingle()` |
| `src/modules/home/ui/components/search-filters/subcategory-menu.tsx` | No @/payload-types import | VERIFIED | Uses `Tables<"categories">` — no payload reference |
| `src/modules/products/server/procedures.ts` | productsRouter rewritten to ctx.supabase | VERIFIED | `from("products")` in both getOne and getMany |
| `src/modules/reviews/server/procedures.ts` | reviewsRouter rewritten to ctx.supabase | VERIFIED | `from("reviews")` + user_id/product_id field names |
| `src/modules/library/server/procedures.ts` | libraryRouter rewritten to ctx.supabase | VERIFIED | `from("orders")` two-step pattern |
| `src/modules/checkout/server/procedures.ts` | checkoutRouter using ctx.supabase + user_tenants | VERIFIED | `from("user_tenants")` in verify procedure |
| `src/app/(app)/api/stripe/webhooks/route.ts` | Stripe webhook using supabaseAdmin | VERIFIED | 4 supabaseAdmin calls; no getPayload |
| `src/payload.config.ts` | DELETED — file does not exist | VERIFIED | Confirmed absent from filesystem |
| `src/collections/` | DELETED — directory does not exist | VERIFIED | Confirmed absent from filesystem |
| `src/app/(payload)/` | DELETED — directory does not exist | VERIFIED | Confirmed absent from filesystem |
| `tests/smoke/rls-isolation.spec.ts` | RLS enforcement test with load gate | VERIFIED | Contains load gate + 4 woodworks-jan absence assertions |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `categoriesRouter.getMany` | `ctx.supabase.from("categories")` | PostgREST self-join `categories!parent_id(*)` | WIRED | Line 12: pattern confirmed in procedures.ts |
| `tenantsRouter.getOne` | `ctx.supabase.from("tenants")` | `.eq("slug", input.slug).maybeSingle()` | WIRED | Lines 19–23: exact pattern present |
| `products.getMany tenantSlug filter` | two-step fetch tenant_id by slug | `from("tenants").select("id").eq("slug", ...)` | WIRED | Lines 131–148: pattern confirmed |
| `products.getMany category filter` | two-step via `categories!parent_id(id)` | `.from("categories").select("id, subcategories:categories!parent_id(id)")` | WIRED | Lines 165–178: pattern confirmed |
| `products.getMany tag filter` | three-step via product_tags | `.from("product_tags").select("product_id").in("tag_id", tagIds)` | WIRED | Lines 201–204: pattern confirmed |
| `checkout.verify` | `user_tenants` join table | `.from("user_tenants").select("tenant_id").eq("user_id", ctx.user.id).maybeSingle()` | WIRED | Lines 17–21 confirmed |
| `Stripe webhook checkout.session.completed` | `supabaseAdmin.from("orders").insert` | service-role client bypasses RLS | WIRED | Lines 73–79: insert with stripe_checkout_session_id, user_id, product_id |
| `reviews.update ownership check` | `existingReview.user_id !== ctx.user.id` | Supabase field is user_id | WIRED | Line 99 confirmed |
| `library.getMany orders → products` | two-step: orders.product_id[] → products.in | `from("orders").select("product_id")` | WIRED | Lines 57–80 confirmed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-01 | 04-02, 04-05 | Products tRPC router rewritten to use Supabase client | SATISFIED | productsRouter: zero ctx.db, full Supabase implementation |
| API-02 | 04-01 (note), 04-05 | Auth tRPC router rewritten to use Supabase Auth | SATISFIED | authRouter uses `ctx.user` from Supabase session; no Payload |
| API-03 | 04-01, 04-05 | Tenants tRPC router rewritten to use Supabase client | SATISFIED | tenantsRouter: `from("tenants")`, no ctx.db |
| API-04 | 04-03, 04-05 | Orders tRPC router rewritten (reviews/library cover orders table) | SATISFIED | libraryRouter and reviewsRouter use `from("orders")`, `from("reviews")` |
| API-05 | 04-04, 04-05 | Checkout tRPC router and Stripe webhook updated for UUID format | SATISFIED | checkoutRouter: user_tenants join; webhook: supabaseAdmin; snake_case fields |
| API-06 | 04-01, 04-05 | Categories and Tags tRPC routers rewritten | SATISFIED | categoriesRouter + tagsRouter: full Supabase, no ctx.db |
| API-07 | 04-01, 04-02, 04-03, 04-04, 04-05 | User-facing procedures use anon client; Stripe webhook uses service-role | SATISFIED | All tRPC procedures use ctx.supabase (anon); webhook explicitly imports supabaseAdmin |

All 7 requirement IDs (API-01 through API-07) claimed in plan frontmatter are accounted for and satisfied.

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps API-01 through API-07 exclusively to Phase 4 — no orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/modules/checkout/server/procedures.ts` | 16 | Comment `// this replaces ctx.db.findByID(...)` — contains `ctx.db` in a comment string | Info | Zero impact — it's a code comment documenting the migration, not a live call |

No blockers. No stubs. No empty implementations. The `ctx.db` occurrence is a documentation comment in checkout/server/procedures.ts and is not a live Payload call.

The `getPayloadConfigFromPayload` function name in `src/components/ui/chart.tsx` contains the word "payload" but is a shadcn/ui chart helper with no relationship to Payload CMS — confirmed by absence of any Payload package imports in that file.

---

### Human Verification Required

The following items cannot be verified programmatically and require a running application:

#### 1. Stripe Webhook End-to-End

**Test:** Run `stripe trigger checkout.session.completed` via Stripe CLI in test mode against a running dev server.
**Expected:** An `orders` row appears in Supabase with correct `user_id` and `product_id` fields populated.
**Why human:** Stripe webhook requires live Stripe CLI, running dev server, and Supabase network access.

#### 2. RLS Isolation at Runtime

**Test:** Visit `http://ceramics-by-ana.localhost:3000` in a browser with the dev server running.
**Expected:** Ceramics-by-Ana products are visible; Oak Serving Board, Walnut Key Tray, Pine Floating Shelf, and Maple Jewelry Box are not visible.
**Why human:** Playwright tests are present and cover this, but require a running dev server with seeded Supabase data. Whether seed data is actually populated in the connected Supabase instance cannot be verified statically.

#### 3. Checkout Flow (Purchase + Redirect)

**Test:** As an authenticated user on a tenant storefront, add a product to cart and attempt purchase.
**Expected:** Stripe Checkout session is created and user is redirected to Stripe's hosted payment page.
**Why human:** Requires live Stripe test keys, running dev server, and authenticated user session.

---

### Gaps Summary

No gaps. All 22 must-have truths are verified. All 7 requirement IDs are satisfied. All Payload infrastructure files are confirmed deleted. All routers use ctx.supabase exclusively. The tRPC context no longer loads Payload at request time.

The phase goal — "migrate all tRPC routers from Payload ORM (ctx.db) to Supabase (ctx.supabase), then remove Payload from the codebase entirely" — is achieved at the application layer. Payload npm packages remain in package.json by design (deferred to Phase 7), which is within scope as documented in the Phase 5 plan.

---

_Verified: 2026-03-06T17:30:00Z_
_Verifier: Claude (gsd-verifier)_

# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Hardcoded Store URL Generation:**
- Issue: Store URLs are hardcoded as `.shop.com` in the sign-up UI. This is a temporary placeholder pending proper subdomain support.
- Files: `src/modules/auth/ui/views/sign-up-view.tsx` (line 103)
- Impact: Users see incorrect preview URLs during sign-up; actual store URLs may differ from what's shown. Causes UX confusion.
- Fix approach: Implement proper URL generation logic using environment-based domain configuration and subdomain routing when enabled.

**Subdomain Routing Not Fully Implemented:**
- Issue: Subdomain routing feature is disabled (`NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING="false"`) but code contains TODO and conditional logic anticipating it.
- Files: `src/modules/checkout/ui/views/checkout-view.tsx` (line 41), `src/middleware.ts`
- Impact: Authentication redirects will break when subdomains are enabled; redirect logic hardcodes `/sign-in` path without tenant context.
- Fix approach: Complete subdomain routing implementation with proper auth redirect handling and URL generation utilities.

**Missing Error Logging in Critical Paths:**
- Issue: Webhook handler uses console.log for errors instead of proper error tracking; no structured logging for payment failures.
- Files: `src/app/(app)/api/stripe/webhooks/route.ts` (lines 23, 115)
- Impact: Payment processing failures may go unnoticed; debugging production issues is difficult without structured logs.
- Fix approach: Implement centralized error logging service; integrate error tracking (e.g., Sentry); add structured logging for webhook events.

**Seed Script Hardcoded Credentials:**
- Issue: Admin account created with hardcoded password "demo" in seed script; no environment configuration.
- Files: `src/seed.ts` (line 117)
- Impact: Credentials are leaked if seed script runs in production; security risk for demo accounts.
- Fix approach: Use environment variables for seed credentials; add checks to prevent accidental production seeding.

**Console Statements in Production Code:**
- Issue: Development console.log statements left in checkout category dropdown and seed script.
- Files: `src/modules/home/ui/components/search-filters/category-dropdown.tsx`, `src/seed.ts`
- Impact: Console noise in production logs; potential information disclosure.
- Fix approach: Remove or replace with proper logging service; configure logging levels for different environments.

## Known Bugs

**Webhook Error Handling Logic Error:**
- Bug: Line 22 in webhook handler has incorrect logic: `if (error! instanceof Error)` should be `if (!(error instanceof Error))` or just `else`.
- Symptoms: Non-Error exceptions are not logged; error condition is inverted.
- Files: `src/app/(app)/api/stripe/webhooks/route.ts` (line 22)
- Trigger: When webhook processing throws non-Error type exceptions (e.g., strings or custom objects).
- Workaround: Current code still logs the error on line 26, but the conditional branch is dead code.

**Cart State Synchronization Issue:**
- Bug: Cart state is stored per-tenant in Zustand but localStorage keys aren't scoped to tenant, risking data collision.
- Symptoms: Users switching between tenant stores could see mixed cart items.
- Files: `src/modules/checkout/store/use-cart-store.ts`
- Trigger: User logs out of one tenant store and accesses another without clearing session.
- Workaround: Clear cart on tenant change (currently partially handled by `clearAllCarts`).

## Security Considerations

**Missing CSRF Protection on Stripe Webhook:**
- Risk: Webhook handler doesn't validate webhook signature before processing (signature validation only constructs event).
- Files: `src/app/(app)/api/stripe/webhooks/route.ts` (lines 14-18)
- Current mitigation: Stripe library validates signature format, but request source is not authenticated.
- Recommendations: Add rate limiting; validate webhook origin; implement idempotency keys for order creation; add logging of webhook sources.

**Hard-coded Stripe API Version:**
- Risk: Stripe API version is pinned to specific date (`2025-08-27.basil`) with no mechanism to update during Stripe API upgrades.
- Files: `src/lib/stripe.ts` (line 4)
- Current mitigation: None; manual code update required.
- Recommendations: Consider using latest stable API version; add monitoring for Stripe API deprecation notices; document version pinning decision.

**No Verification of Tenant-Product Association in Orders:**
- Risk: When creating orders via webhook, product ownership is not verified before association.
- Files: `src/app/(app)/api/stripe/webhooks/route.ts` (lines 82-93)
- Current mitigation: Product metadata includes `stripeAccountId`; webhook handler uses it.
- Recommendations: Add explicit validation that product belongs to the Stripe account receiving webhook; add audit logging for order creation.

**Authentication Context Missing in Webhook:**
- Risk: Webhook handler lacks proper authentication; metadata is trusted without verification.
- Files: `src/app/(app)/api/stripe/webhooks/route.ts` (lines 50-56)
- Current mitigation: Stripe webhook signature validation.
- Recommendations: Add additional validation of user existence and active status before creating orders; verify user hasn't been deleted between checkout and webhook.

**Environment Variables Not Validated:**
- Risk: Required env vars (`STRIPE_SECRET_KEY`, `DATABASE_URI`, `PAYLOAD_SECRET`) lack validation at startup.
- Files: `src/payload.config.ts`, `src/lib/stripe.ts`
- Current mitigation: None; errors will occur at runtime.
- Recommendations: Add startup validation script; fail early with clear error messages; document all required env vars in README.

## Performance Bottlenecks

**N+1 Query in Checkout Product Retrieval:**
- Problem: `getProducts` query with `depth: 2` fetches full tenant and related data for every product; no batching.
- Files: `src/modules/checkout/server/procedures.ts` (lines 182-200)
- Cause: Each product fetch includes related category, tenant, and media. With large product lists, this causes multiple DB calls.
- Improvement path: Implement batch fetching; consider query optimization or aggregation pipeline; cache tenant data.

**Cart Store Not Persisted to Browser Storage:**
- Problem: Cart state is ephemeral; users lose cart on page reload.
- Files: `src/modules/checkout/store/use-cart-store.ts`
- Cause: Zustand store uses only in-memory state; no localStorage integration.
- Improvement path: Add localStorage persistence with tenant-scoped keys; implement hydration on mount.

**Missing Database Indexes:**
- Problem: No evidence of database indexes on frequently queried fields (tenant.slug, product.id, user.id).
- Files: Collection definitions throughout
- Cause: Payload CMS configuration doesn't specify indexes.
- Improvement path: Profile slow queries; add indexes on relationship fields and search parameters; monitor query performance.

**Inefficient Category Filtering:**
- Problem: Category dropdown renders all categories without pagination or virtualization.
- Files: `src/modules/home/ui/components/search-filters/category-dropdown.tsx`
- Cause: No pagination on category list; could be problematic with hundreds of categories.
- Improvement path: Implement pagination or search filtering; add windowing if dropdown renders many items.

## Fragile Areas

**Stripe Account Linking Logic:**
- Files: `src/modules/checkout/server/procedures.ts` (lines 43-57)
- Why fragile: Assumes user always has exactly one tenant (`user.tenants?.[0]`); breaks with multi-tenant users.
- Safe modification: Add validation for tenant count; handle cases where tenant is missing; add error messages for user feedback.
- Test coverage: No visible tests for verify procedure; edge cases untested.

**Webhook Event Processing:**
- Files: `src/app/(app)/api/stripe/webhooks/route.ts`
- Why fragile: Switch statement only handles two event types; unhandled events throw errors but don't return proper response.
- Safe modification: Add default case that returns 200 OK (Stripe expects 2xx for received webhooks); validate event data structure; add event filtering at Stripe level.
- Test coverage: No visible tests; webhook payloads and error scenarios untested.

**Multi-Tenant Product Query Logic:**
- Files: `src/modules/checkout/server/procedures.ts` (lines 67-89)
- Why fragile: Complex nested `where` clauses with multiple conditions; easy to introduce permission bypasses.
- Safe modification: Extract query building into reusable utility; add comprehensive tests; use TypeScript strict mode; add query validation.
- Test coverage: No visible test coverage for query building; permission boundaries untested.

**Auth State Management:**
- Files: `src/modules/auth/ui/views/sign-up-view.tsx`, `src/trpc/init.ts`
- Why fragile: Session context obtained from Payload headers; no fallback or error handling if session is malformed.
- Safe modification: Add null checks; validate session structure; handle auth state transitions gracefully; add loading states.
- Test coverage: No visible tests for auth flows; edge cases (network failures, timeouts) not handled.

## Scaling Limits

**MongoDB Default Pagination:**
- Current capacity: `DEFAULT_LIMIT = 8` items per query
- Limit: With millions of products, infinite scroll could become slow without proper pagination cursors.
- Scaling path: Implement cursor-based pagination; add caching layer; consider read replicas for heavy queries.

**Stripe Account Connection:**
- Current capacity: One Stripe account per tenant
- Limit: Scaling to multiple payment processors or account configurations requires schema changes.
- Scaling path: Abstract payment provider interface; add payment processor selection; implement provider routing logic.

**Single Webhook Endpoint:**
- Current capacity: One webhook handler processing all Stripe events
- Limit: High-volume events could cause bottlenecks; no queue system.
- Scaling path: Implement message queue (Bull, RabbitMQ); add webhook retry logic; separate event processing to workers.

**Browser Local Storage for Cart:**
- Current capacity: ~5-10MB limit per domain (browser dependent)
- Limit: Large product lists could hit storage limits; users can't sync cart across devices.
- Scaling path: Move cart state to database; implement server-side cart persistence; add synchronization.

## Dependencies at Risk

**PayloadCMS Multi-Tenant Plugin:**
- Risk: Custom plugin with potential version incompatibilities; tied to specific Payload version (3.34.0).
- Impact: Version upgrades blocked; security patches delayed.
- Migration plan: Monitor plugin updates; test version compatibility; consider alternative multi-tenancy solution if plugin abandoned.

**Vercel Blob Storage:**
- Risk: Vendor lock-in; media storage dependent on Vercel infrastructure.
- Impact: Difficult to migrate; costs increase with usage; service outages affect media serving.
- Migration plan: Implement abstraction layer for storage provider; support S3 as fallback; monitor pricing.

**Old React Hook Form API:**
- Risk: Version 7.55.0 is not latest; potential security issues; API differences in newer versions.
- Impact: Breaking changes in version 8+; missing features and bug fixes.
- Migration plan: Schedule upgrade to react-hook-form v8+; test form components; update to new API.

**Zustand State Management:**
- Risk: Relatively new library; alternative community support compared to Redux/Jotai.
- Impact: Potential knowledge gaps in team; smaller ecosystem for plugins/middleware.
- Migration plan: Document store patterns; ensure code review coverage; consider Redux if complexity increases.

## Missing Critical Features

**No Refund Processing System:**
- Problem: Refund policy is stored (30-day, 14-day, etc.) but no backend logic to process refunds.
- Blocks: Customers cannot request refunds; merchants cannot issue refunds; policy is meaningless.
- Priority: HIGH - Customers will be unhappy; potential legal compliance issues.

**No Order/Purchase History for Customers:**
- Problem: Orders are created but customers cannot view their purchase history.
- Blocks: Customers cannot redownload products; merchants cannot see customer lifetime value.
- Priority: HIGH - Core marketplace feature missing.

**No Product Inventory Management:**
- Problem: Products don't have stock limits; digital products assumed unlimited.
- Blocks: Cannot sell limited-edition items; cannot manage physical product inventory.
- Priority: MEDIUM - Not blocking for digital-only marketplace initially.

**No Review/Rating System Backend:**
- Problem: Reviews collection exists but no mutation endpoints to create/update reviews; no moderation.
- Blocks: Users cannot leave reviews; merchants cannot build credibility.
- Priority: MEDIUM - Important for marketplace trust.

**No Merchant Communication System:**
- Problem: No way for customers to contact sellers; no support tickets or messaging.
- Blocks: Customers cannot ask questions about products; disputes cannot be resolved.
- Priority: MEDIUM - Growing concern as marketplace scales.

## Test Coverage Gaps

**No Tests for Stripe Webhook Handler:**
- What's not tested: Webhook event parsing, order creation flow, error handling, race conditions.
- Files: `src/app/(app)/api/stripe/webhooks/route.ts`
- Risk: Payment processing failures could go undetected; money could be lost on failed orders.
- Priority: HIGH - Critical payment path.

**No Tests for Auth Flows:**
- What's not tested: Sign-up, sign-in, session management, permission checks.
- Files: `src/modules/auth/ui/views/sign-up-view.tsx`, `src/trpc/init.ts`
- Risk: Auth bypasses undetected; users locked out unexpectedly.
- Priority: HIGH - Security and core functionality.

**No Tests for Checkout Logic:**
- What's not tested: Product validation, price calculation, tenant permissions, platform fee calculation.
- Files: `src/modules/checkout/server/procedures.ts`
- Risk: Customers charged incorrectly; merchants earn wrong amounts.
- Priority: HIGH - Financial impact.

**No Tests for Database Queries:**
- What's not tested: Multi-tenant isolation, permission boundaries, query correctness.
- Files: Throughout collections and procedures
- Risk: Data leaks between tenants; unauthorized data access.
- Priority: HIGH - Security and compliance.

**No E2E Tests:**
- What's not tested: Full user flows (browse → add to cart → checkout → payment → download).
- Files: N/A
- Risk: Integration failures between components undetected until production.
- Priority: MEDIUM - Catch integration issues early.

---

*Concerns audit: 2026-02-23*

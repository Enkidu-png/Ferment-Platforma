---
phase: 04-api-layer-migration
plan: "04"
subsystem: payments
tags: [stripe, supabase, trpc, webhook]

requires:
  - phase: 04-01
    provides: ctx.supabase pattern and user_tenants join table awareness
  - phase: 04-02
    provides: products Supabase query patterns (snake_case fields, tenant_id filter)
  - phase: 04-03
    provides: reviews/library Supabase migration patterns

provides:
  - checkoutRouter fully on ctx.supabase — verify, purchase, getProducts
  - Stripe webhook using supabaseAdmin (service-role) for users/orders/tenants writes
  - user_tenants join pattern to resolve authenticated user to tenant

affects: [05-payload-removal, 06-admin-ui, 07-deployment]

tech-stack:
  added: []
  patterns:
    - "user_tenants two-step join: user_id → tenant_id → tenants row (replaces Payload users depth-2 populate)"
    - "supabaseAdmin for unauthenticated server contexts (webhooks) to bypass RLS"
    - "Snake_case field names throughout: stripe_account_id, stripe_details_submitted, is_archived"

key-files:
  created: []
  modified:
    - src/modules/checkout/server/procedures.ts
    - src/app/(app)/api/stripe/webhooks/route.ts

key-decisions:
  - "checkout.verify: use user_tenants join table (not Payload users) — new Supabase users have no Payload record, causing thrown errors in the old implementation"
  - "Stripe webhook: use supabaseAdmin (service-role) not ctx.supabase — webhook has no auth context; anon client would be blocked by RLS"
  - "orders.insert: no 'name' field — Supabase orders table has no name column (unlike Payload collection)"

patterns-established:
  - "Webhook pattern: always use supabaseAdmin for server-side writes without user auth context"
  - "user_tenants pattern: look up tenant_id from user_id before any tenant-specific query"

requirements-completed: [API-05, API-07]

duration: 5min
completed: 2026-03-06
---

# Phase 4 Plan 4: Checkout Router and Stripe Webhook Summary

**checkoutRouter and Stripe webhook rewritten from Payload ctx.db to ctx.supabase/supabaseAdmin, fixing live bug where checkout.verify threw for all new Supabase users**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T16:23:48Z
- **Completed:** 2026-03-06T16:28:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed live-breaking bug: checkout.verify called ctx.db.findByID({ collection: "users" }) which threw for all Supabase users (no Payload record); replaced with user_tenants join table pattern
- Rewrote entire checkoutRouter (verify/purchase/getProducts) to use ctx.supabase with Supabase snake_case field names
- Rewrote Stripe webhook to use supabaseAdmin (service-role), removing all getPayload/payload-config imports; webhook now correctly bypasses RLS for order creation and tenant update

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite checkoutRouter to use ctx.supabase** - `73322a2` (feat)
2. **Task 2: Rewrite Stripe webhook to use supabaseAdmin** - `0cb5253` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/modules/checkout/server/procedures.ts` - checkoutRouter rewritten: verify uses user_tenants join, purchase uses Supabase tenants/products, getProducts queries Supabase
- `src/app/(app)/api/stripe/webhooks/route.ts` - Stripe webhook rewritten: supabaseAdmin replaces all payload calls; orders insert uses snake_case fields without 'name' column

## Decisions Made
- checkout.verify uses a two-step query: first user_tenants to get tenant_id, then tenants to get stripe_account_id. This replaces the broken Payload user depth-2 populate.
- Stripe webhook uses supabaseAdmin (service-role key) not ctx.supabase because webhooks have no authenticated user context. The anon client would be rejected by RLS on writes.
- orders.insert omits 'name' field — the Supabase orders table schema has no name column (unlike the Payload orders collection which had a name field).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in scripts/seed.ts (possibly 'undefined' access) — these are out of scope for this plan and were not modified. The checkout and webhook files compile without errors.

## Next Phase Readiness
- Checkout flow fully migrated: verify, purchase, getProducts, and webhook all use Supabase
- Phase 5 (Payload removal) can now safely remove Payload entirely — the last consumer of ctx.db in the checkout domain is gone
- No blockers for Phase 5

---
*Phase: 04-api-layer-migration*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: src/modules/checkout/server/procedures.ts
- FOUND: src/app/(app)/api/stripe/webhooks/route.ts
- FOUND: .planning/phases/04-api-layer-migration/04-04-SUMMARY.md
- FOUND commit: 73322a2 (feat(04-04): rewrite checkoutRouter to use ctx.supabase)
- FOUND commit: 0cb5253 (feat(04-04): rewrite Stripe webhook to use supabaseAdmin)

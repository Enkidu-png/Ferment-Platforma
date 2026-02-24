# Phase 1: Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision the complete Supabase infrastructure: PostgreSQL tables for all 8 collections, Row Level Security policies, JWT auth configuration with custom claims, and Supabase client library setup in the Next.js app. This is the foundation everything else builds on — no auth flows, no data migration, no UI.

</domain>

<decisions>
## Implementation Decisions

### Multi-Tenant Architecture
- Multi-tenant platform architecture is confirmed: each merchant gets their own shop with separate subdomain
- Tenant isolation enforced at the database layer via RLS (not application-level filtering)
- Every query scoped to a tenant must go through RLS policies

### Merchant Status Design
- Four statuses: `pending`, `approved`, `rejected`, `suspended`
- Flow: new registration → `pending` → admin approves (→ `approved`) or rejects (→ `rejected`)
- Rejected merchants can reapply: status goes back to `pending`
- Suspended merchants: shop goes invisible, all products hidden from buyers immediately
- Pending merchants CAN set up their shop (add products, configure store) before approval — products stay hidden until approved

### Public Data Visibility (RLS Rules)
- Browsing is fully public — no account needed to see products or artist shops
- Public (anon access allowed): products from approved merchants, shop profiles of approved merchants
- Private (auth required): orders, user account details, merchant dashboard data
- Only `approved` merchants are visible to the public — `pending` and `suspended` shops are invisible to buyers
- This visibility rule must be enforced at the RLS level (not just UI-level)

### Supabase Environment Setup
- Single Supabase project (production only) — the app is not yet live, no separate dev project
- Supabase project does not exist yet — plan must include project creation and configuration steps
- Manage everything through the Supabase dashboard (not Supabase CLI) — no migration files, no CLI tooling
- Install `@supabase/supabase-js` and `@supabase/ssr` into the Next.js app in this phase
- Set up four client factory files in `src/lib/supabase/`: server component client, middleware client, client component client, service role client

### Migration Approach
- App is not currently live — clean migration, no downtime concerns
- Build Supabase completely first, then switch the app over
- Keep Payload CMS accessible during development as a reference for existing schemas and data
- Payload is removed in the final phase (Phase 7)

### Claude's Discretion
- Exact PostgreSQL column types and constraints (within schema requirements)
- RLS policy syntax and implementation details
- File and folder organization within `src/lib/supabase/`

</decisions>

<specifics>
## Specific Ideas

- The planner should generate the full SQL for all 8 tables as executable statements (not pseudo-code) — ready to paste into the Supabase SQL editor
- The planner should generate complete RLS policy SQL for each table, covering anon read, authenticated write, and tenant isolation
- The JWT custom claims hook embeds `tenant_id` (UUID of the merchant's tenant row, null for buyers with no shop) and `app_role` (`'user'` for regular users/buyers, `'super-admin'` for platform admins)
- Merchants are identified by `tenant_id` presence in the JWT — not a separate `'merchant'` role value. If `tenant_id` is non-null, the user is a merchant.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-24*

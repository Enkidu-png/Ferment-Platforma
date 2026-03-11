# Phase 7: Payload Removal + Cutover - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all Payload CMS code and packages from the codebase, configure Vercel for production, send password reset emails to existing artists via a one-time script, and confirm the app is fully working on Supabase. The migration is complete when `npm run build` passes with zero Payload references, smoke tests pass across all critical flows, and artists can log in. **Core principle: the app with all its functionalities must work perfectly on Supabase — Payload removal is the final confirmation that the migration succeeded, not just a code deletion exercise.**

</domain>

<decisions>
## Implementation Decisions

### Password reset emails
- Use Supabase built-in email provider — no extra package or API key needed
- Trigger via a script: `scripts/send-password-resets.ts` using `supabase.auth.admin.generateLink()` per user
- Script must support dry-run mode (log emails without sending) for pre-flight validation
- Email content: customise the Supabase dashboard Email Template to explain the migration — "Ferment Platforma has upgraded its platform. Please reset your password to log in." with the reset link
- Timing: script runs as the **last step** of Phase 7, after build passes and smoke tests are green — so artists get the email only when the platform is ready to receive them
- Script also covers the ADMN-03 deferred fragment: rejected merchant email notification can be sent here if an email service is in place (or noted as still deferred if Supabase built-in limits apply)

### Production cutover
- This is a **real go-live** — not dev cleanup only. Phase 7 ends with the app live in production.
- Old Payload/MongoDB stack is already down — no downtime window needed
- Vercel needs to be configured as part of this phase:
  - Link the Vercel project (or create if not exists)
  - Add all Supabase environment variables to Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, plus Stripe vars
- Deploy to production after smoke tests pass

### Cleanup scope
- **Delete**: `src/payload-types.ts` — Payload-generated dead code; nothing should import it post-Phase 4
- **Delete**: `scripts/verify-blob-urls.ts` — one-time migration verification script, job done
- **Keep**: `scripts/seed.ts` — useful for re-seeding fresh dev environments; keep it
- **Remove** Payload-specific npm scripts from `package.json`: `generate:types` (`payload generate:types`) and `db:fresh` (`payload migrate:fresh`) — these call the Payload CLI which won't be installed; remove them (and optionally replace with Supabase equivalents)
- **Remove all** `@payloadcms/*` and `payload` and `mongodb` packages from `package.json`
- **Verify** `src/` has zero imports of any Payload or MongoDB module before declaring complete

### Build verification
- Verification order: **cleanup → local build → smoke tests → Vercel deploy → send password resets**
- Local build (`npm run build`) must complete with zero errors and zero references to `payload`, `@payloadcms`, or `mongodb` in the output
- Run existing Playwright smoke tests across all four critical flows:
  1. **Storefront loads** — artist subdomain pages render, product images load from Supabase Storage
  2. **Auth flow** — login, session persistence across refresh, artist registration
  3. **Admin panel** — `/admin` route accessible, merchant/product/order views load
  4. **Checkout flow** — cart, Stripe checkout, webhook order creation

### Claude's Discretion
- Whether to add replacement npm scripts for Supabase (e.g., `db:types` → `supabase gen types typescript`) — add if they'd be useful, skip if not needed
- Exact email template copy (migration explanation) — keep it short and clear
- Order of individual cleanup tasks within each plan

</decisions>

<specifics>
## Specific Ideas

- "The app with all its functionalities must not die if Payload is deleted — it must be perfectly migrated with all functionalities to Supabase." — this is the primary success criterion in the user's words
- Password resets are the user-facing moment of go-live: artists receive the email and log in to the Supabase-powered platform for the first time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seed.ts`: Supabase-based seed script from Phase 3 — keep as dev utility
- `src/lib/supabase/server.ts` and `src/lib/supabase/admin.ts`: Service-role client available for the password reset script
- Existing Playwright test suite: smoke tests already cover storefront and auth flows — extend/run for final verification

### Established Patterns
- All tRPC routers already use `ctx.supabase` — no Payload imports should remain in `src/modules/`
- `supabaseAdmin` (service-role client) pattern established in Phase 4/5/6 — use same pattern in password reset script

### Integration Points
- `package.json`: Remove 7 Payload packages and 2 Payload-specific npm scripts
- `src/payload-types.ts`: Delete (confirm no imports first)
- `scripts/verify-blob-urls.ts`: Delete
- Vercel dashboard: Add all Supabase + Stripe env vars before deploying

</code_context>

<deferred>
## Deferred Ideas

- ADMN-03 rejected merchant email notification — if Supabase built-in email limits (4/hour Free tier) are too restrictive for batching, add Resend in a future phase
- Supabase Realtime order notifications for merchants — v2 requirement (DISC-V2-02)
- Artist analytics dashboard — v2 (ADMN-V2-02)

</deferred>

---

*Phase: 07-payload-removal-+-cutover*
*Context gathered: 2026-03-11*

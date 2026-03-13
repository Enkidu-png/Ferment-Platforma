# Phase 2: Auth Migration - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Supabase Auth fully replaces Payload authentication. Existing sign-in and sign-up pages are rewired (not rebuilt) to use Supabase Auth. Middleware and tRPC context are updated to use the Supabase client. New artist registration creates a pending tenant row. No existing artist data migration — that is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Login & Register UX
- Existing pages at `src/app/(app)/(auth)/sign-in/page.tsx` and `sign-up/page.tsx` must be rewired, not created from scratch
- Post-login redirect: always to artist dashboard
- Auth errors (wrong password, account not found): shown inline under the form
- Session is always persistent — no "remember me" checkbox

### Session Behavior
- Silent token refresh via Supabase SSR; only redirect to sign-in if refresh fails
- Single session shared across all subdomains — cookie domain must be configured for `ferment.com` parent domain
- Session duration: Supabase default (7 days idle expiry)
- Password change signs out all active sessions on all devices

### Existing Artists
- No existing artists to migrate — this phase has no migration concern
- Payload auth fallback is irrelevant — no real users yet

### Registration & Onboarding
- Registration collects: email + password + shop name
- Email verification required before application is considered submitted (Supabase sends confirmation email)
- After email verification, artist is in pending state — a `tenants` row with `status=pending` is created
- Pending artists see a simple waiting page explaining their application is under review
- Full dashboard access only granted after admin approval (Phase 6 Admin UI will handle approval)

### Claude's Discretion
- Exact waiting page copy and design
- Loading/transition states during auth operations
- Specific cookie domain configuration details
- Error message wording

</decisions>

<specifics>
## Specific Ideas

- The existing auth module structure (`src/modules/auth/`) should be preserved and extended, not replaced
- Supabase SSR (`@supabase/ssr`) cookie handling must work with Next.js 15 async `cookies()` API — note this as a known risk for the researcher to verify

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auth-migration*
*Context gathered: 2026-03-06*

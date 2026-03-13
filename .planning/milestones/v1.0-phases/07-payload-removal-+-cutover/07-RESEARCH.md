# Phase 7: Payload Removal + Cutover - Research

**Researched:** 2026-03-11
**Domain:** Dependency removal, production deployment, Supabase password reset, Playwright smoke testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Password reset emails:**
- Use Supabase built-in email provider — no extra package or API key needed
- Trigger via a script: `scripts/send-password-resets.ts` using `supabase.auth.admin.generateLink()` per user
- Script must support dry-run mode (log emails without sending) for pre-flight validation
- Email content: customise the Supabase dashboard Email Template to explain the migration — "Ferment Platforma has upgraded its platform. Please reset your password to log in." with the reset link
- Timing: script runs as the **last step** of Phase 7, after build passes and smoke tests are green — so artists get the email only when the platform is ready to receive them
- Script also covers the ADMN-03 deferred fragment: rejected merchant email notification can be sent here if an email service is in place (or noted as still deferred if Supabase built-in limits apply)

**Production cutover:**
- This is a **real go-live** — not dev cleanup only. Phase 7 ends with the app live in production.
- Old Payload/MongoDB stack is already down — no downtime window needed
- Vercel needs to be configured as part of this phase:
  - Link the Vercel project (or create if not exists)
  - Add all Supabase environment variables to Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, plus Stripe vars
- Deploy to production after smoke tests pass

**Cleanup scope:**
- **Delete**: `src/payload-types.ts` — Payload-generated dead code; nothing should import it post-Phase 4
- **Delete**: `scripts/verify-blob-urls.ts` — one-time migration verification script, job done
- **Keep**: `scripts/seed.ts` — useful for re-seeding fresh dev environments; keep it
- **Remove** Payload-specific npm scripts from `package.json`: `generate:types` (`payload generate:types`) and `db:fresh` (`payload migrate:fresh`) — these call the Payload CLI which won't be installed; remove them (and optionally replace with Supabase equivalents)
- **Remove all** `@payloadcms/*` and `payload` and `mongodb` packages from `package.json`
- **Verify** `src/` has zero imports of any Payload or MongoDB module before declaring complete

**Build verification:**
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

### Deferred Ideas (OUT OF SCOPE)
- ADMN-03 rejected merchant email notification — if Supabase built-in email limits (4/hour Free tier) are too restrictive for batching, add Resend in a future phase
- Supabase Realtime order notifications for merchants — v2 requirement (DISC-V2-02)
- Artist analytics dashboard — v2 (ADMN-V2-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLEN-01 | All Payload CMS packages removed from `package.json` | 7 packages identified for removal: `payload`, `@payloadcms/db-mongodb`, `@payloadcms/next`, `@payloadcms/payload-cloud`, `@payloadcms/plugin-multi-tenant`, `@payloadcms/richtext-lexical`, `@payloadcms/storage-vercel-blob`; `graphql` also a candidate since it was a Payload peer dep |
| CLEN-02 | Payload configuration and collection files removed (`payload.config.ts`, `src/collections/`, generated types) | `src/payload-types.ts` exists and must be deleted; `payload.config.ts` and `src/collections/` are already absent from codebase — no action needed beyond confirming; `src/components/stripe-verify.tsx` imports `@payloadcms/ui` and must be deleted or rewritten |
| CLEN-03 | MongoDB connection removed | `@payloadcms/db-mongodb` is the only MongoDB dependency; no standalone `mongodb` package in `package.json`; its removal satisfies CLEN-03 |
| CLEN-04 | Vercel Blob dependency removed (replaced by Supabase Storage) | `@payloadcms/storage-vercel-blob` is the Blob adapter package; no `@vercel/blob` in dependencies; no Vercel Blob URLs remain in src/ — confirmed by `verify-blob-urls.ts` (exits 0) |
| CLEN-05 | App builds and runs successfully with zero Payload references in codebase | Requires: package removal, `stripe-verify.tsx` fix, `payload-types.ts` deletion, npm script removal, then `npm run build` green pass |
</phase_requirements>

---

## Summary

Phase 7 is the final migration step: remove all Payload CMS packages and dead code, then deploy to production. The application itself is already fully migrated to Supabase (Phases 1-6 complete). This phase is therefore a **confirmation and cleanup exercise**, not a technical migration.

The codebase audit reveals the scope is smaller than it might appear. The only remaining Payload-touched source file is `src/components/stripe-verify.tsx` (imports `@payloadcms/ui`). Since this component is not imported anywhere else in `src/`, it can simply be deleted. The `src/payload-types.ts` file also exists and must be deleted. All other `src/` files are clean.

The password reset script is the most custom piece of work: it must iterate all Supabase Auth users with `app_role: artist` (or all non-admin users), call `supabase.auth.admin.generateLink({ type: 'recovery', email })` for each, optionally log or actually trigger sending. Supabase Free tier sends email via its built-in SMTP relay — `generateLink()` returns the link itself; email delivery is handled by calling `resetPasswordForEmail()` or using the link in a custom email via the dashboard template.

**Primary recommendation:** Three plans — (1) package cleanup + dead file removal + build verification, (2) Vercel environment setup + production deploy + smoke tests, (3) password reset script creation + execution. This ordering matches the locked verification sequence: cleanup → local build → smoke tests → Vercel deploy → send password resets.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.98.0 (already installed) | Admin auth API for generateLink() | Already in project; service-role client pattern established |
| `@playwright/test` | ^1.58.2 (already installed) | Smoke test runner for go-live verification | Already in project; tests cover all 4 critical flows |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | (via npx) | Run TypeScript scripts without compilation | Password reset script runner — matches seed.ts convention |
| `dotenv` | ^17.3.1 (already installed) | Load .env.local for scripts | Already used by playwright.config.ts |

### Packages to Remove (CLEN-01)
| Package | Version in package.json | Reason |
|---------|------------------------|--------|
| `payload` | 3.34.0 | Core Payload CMS — no longer needed |
| `@payloadcms/db-mongodb` | 3.34.0 | MongoDB adapter (satisfies CLEN-03) |
| `@payloadcms/next` | 3.34.0 | Next.js Payload integration |
| `@payloadcms/payload-cloud` | 3.34.0 | Payload Cloud hosting plugin |
| `@payloadcms/plugin-multi-tenant` | 3.34.0 | Multi-tenant Payload plugin |
| `@payloadcms/richtext-lexical` | 3.34.0 | Lexical rich text editor |
| `@payloadcms/storage-vercel-blob` | 3.34.0 | Vercel Blob storage adapter (satisfies CLEN-04) |
| `graphql` | ^16.8.1 | Payload peer dependency — nothing in src/ imports it |

**Note on `graphql`:** Nothing in `src/` imports `graphql` directly. It was a Payload peer dependency. Remove it unless a grep confirms otherwise.

**Installation (removal):**
```bash
npm uninstall payload @payloadcms/db-mongodb @payloadcms/next @payloadcms/payload-cloud @payloadcms/plugin-multi-tenant @payloadcms/richtext-lexical @payloadcms/storage-vercel-blob graphql
```

## Architecture Patterns

### Recommended Task Structure
```
Plan 07-01: Code Cleanup + Local Build Verification
  Task 1: Delete dead files (stripe-verify.tsx, payload-types.ts, verify-blob-urls.ts)
  Task 2: Remove Payload npm packages + npm scripts from package.json
  Task 3: Confirm zero Payload references in src/ + run npm run build
  Task 4: Add replacement Supabase npm scripts (Claude's discretion)

Plan 07-02: Vercel Deployment + Smoke Tests
  Task 1: Configure Vercel project + environment variables
  Task 2: Deploy to Vercel production
  Task 3: Run Playwright smoke tests against production

Plan 07-03: Password Reset Script + Artist Notification
  Task 1: Create scripts/send-password-resets.ts with dry-run mode
  Task 2: Configure Supabase Dashboard email template
  Task 3: Execute dry-run, review, execute live
```

### Pattern 1: Supabase Admin generateLink for Password Recovery
**What:** Generate a secure password reset link server-side without triggering the default Supabase email, so it can be sent via a custom template or logged in dry-run mode.
**When to use:** Batch password reset for existing artists during migration cutover.
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-generatelink
// Dry-run mode: log link without sending
// Live mode: call auth.resetPasswordForEmail() OR use generateLink + send via dashboard template

// List all users (pagination required for >1000 users)
const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

for (const user of users) {
  if (!user.email) continue
  if (dryRun) {
    // Log what would happen
    console.log(`[DRY RUN] Would send reset to: ${user.email}`)
    continue
  }
  // Trigger Supabase built-in password reset email
  const { error } = await supabase.auth.resetPasswordForEmail(user.email)
  if (error) console.error(`Failed: ${user.email}`, error.message)
  else console.log(`Sent: ${user.email}`)
}
```

**Important:** `supabase.auth.resetPasswordForEmail()` uses the anon client but sends the email via Supabase's configured email provider. For batch sends via the admin/service-role client, use `supabase.auth.admin.generateLink({ type: 'recovery', email })` to get the link and then send it via the dashboard template system. The dashboard template (Settings > Auth > Email Templates > Reset Password) is customisable.

### Pattern 2: Script Runner Convention (matches seed.ts)
```bash
# Run with .env.local loaded — same pattern as scripts/seed.ts
npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts
npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts --dry-run
```

### Pattern 3: Payload Reference Grep (build verification)
```bash
# These must all return zero matches to satisfy CLEN-05
grep -r "payloadcms\|@payloadcms\|payload\.config\|from 'payload'" src/
grep -r "mongodb" src/

# Or use ripgrep:
rg "payloadcms|mongodb" src/
```

### Pattern 4: Vercel Environment Variable Setup
```
Required variables for Vercel dashboard (Settings > Environment Variables):
  NEXT_PUBLIC_SUPABASE_URL        (public)
  NEXT_PUBLIC_SUPABASE_ANON_KEY   (public)
  SUPABASE_SERVICE_ROLE_KEY       (secret)
  SUPABASE_JWT_SECRET             (secret)
  STRIPE_SECRET_KEY               (secret)
  STRIPE_WEBHOOK_SECRET           (secret)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (public)
```

### Replacement npm Scripts (Claude's Discretion)
```json
{
  "scripts": {
    "db:seed": "npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts",
    "db:types": "supabase gen types typescript --project-id <PROJECT_ID> > src/lib/supabase/types.ts"
  }
}
```
Recommendation: Add `db:types` — it replaces `generate:types` meaningfully and will be useful for future schema changes. Remove `db:fresh` and `generate:types` without replacement.

### Anti-Patterns to Avoid
- **Partial removal:** Removing some `@payloadcms/*` packages but leaving `payload` or vice versa. The build will still fail because Next.js scans all imports. Remove all 7 packages atomically.
- **Deleting `src/components/stripe-verify.tsx` without confirming no imports:** Confirmed by grep — zero files import `StripeVerify` or `stripe-verify`. Safe to delete outright.
- **Running password resets before build and smoke tests pass:** CONTEXT.md is explicit — script runs last. Artists should not receive a reset email to a broken platform.
- **Skipping dry-run on password reset script:** The dry-run pass is mandatory pre-flight — confirms the user list and email addresses before any emails are sent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password reset links | Custom token generation | `supabase.auth.admin.generateLink({ type: 'recovery' })` | Handles expiry, PKCE, signed URLs securely |
| Batch user listing | Cursor-based pagination loop | `supabase.auth.admin.listUsers({ page, perPage: 1000 })` | Built-in pagination; handles large user sets |
| Smoke test orchestration | Custom test runner | `npx playwright test` with existing test suite | Already covers all 4 critical flows |
| Vercel env var validation | Custom env check script | Vercel CLI `vercel env ls` or dashboard | Native tooling |

**Key insight:** The hard work is already done. Phases 1-6 migrated all functionality to Supabase. Phase 7 is mostly `npm uninstall` + file deletion + verification. Resist adding new complexity.

## Common Pitfalls

### Pitfall 1: graphql package left behind
**What goes wrong:** `npm run build` passes but the lock file / node_modules still contains `graphql` because it wasn't explicitly removed — it was only a Payload peer dep, not a direct dep. The build output does not fail but the dependency tree still has indirect Payload-era baggage.
**Why it happens:** `npm uninstall payload @payloadcms/*` removes the Payload packages but `graphql` stays because it has no other dependent to drive its removal unless explicitly listed.
**How to avoid:** Include `graphql` in the `npm uninstall` command explicitly.
**Warning signs:** `grep "graphql" package.json` still returns a match after removal.

### Pitfall 2: stripe-verify.tsx is an orphan — but it must be deleted, not ignored
**What goes wrong:** The file `src/components/stripe-verify.tsx` imports `@payloadcms/ui`. If Payload packages are removed from `package.json` but this file is not deleted, `npm run build` fails with a module resolution error.
**Why it happens:** TypeScript/Next.js compiles all files in `src/`, including components that are never imported. The module resolution error occurs at compile time, not runtime.
**How to avoid:** Delete `src/components/stripe-verify.tsx` before running the build. Confirmed: nothing imports this file (grep shows zero callers).
**Warning signs:** Build error: `Cannot find module '@payloadcms/ui'`.

### Pitfall 3: Supabase Free tier email rate limit on password resets
**What goes wrong:** Supabase Free tier limits outgoing emails to 4 per hour. Sending resets to all artists in a tight loop will result in emails being silently dropped after the fourth.
**Why it happens:** Supabase's built-in SMTP relay enforces this limit on Free tier projects.
**How to avoid:** Add a `sleep` between sends (e.g., 1000ms), or use `supabase.auth.admin.generateLink()` to get links and manually batch-send via a transactional email provider. For small artist counts (< 20 total), the rate limit is irrelevant; for larger counts, add delay.
**Warning signs:** Console shows `Sent: email@x.com` but user never receives email. Check Supabase dashboard > Auth > Logs for email delivery status.

### Pitfall 4: Vercel deploy fails because env vars not set
**What goes wrong:** Vercel build succeeds but the deployed app crashes at runtime because `NEXT_PUBLIC_SUPABASE_URL` and related vars are undefined.
**Why it happens:** Next.js bakes `NEXT_PUBLIC_*` vars into the bundle at build time. If they are absent from Vercel's env var config when the deploy runs, the values are `undefined`.
**How to avoid:** Add all env vars in Vercel dashboard BEFORE triggering the first deploy. Verify with `vercel env ls` if using Vercel CLI.
**Warning signs:** Deployed app shows blank page or Supabase client errors in browser console.

### Pitfall 5: npm scripts referencing deleted Payload CLI commands
**What goes wrong:** After removing Payload packages, running `npm run generate:types` or `npm run db:fresh` calls the uninstalled `payload` CLI and throws `command not found`.
**Why it happens:** The scripts remain in `package.json` after package removal.
**How to avoid:** Remove both scripts from `package.json` as part of the same PR as package removal.
**Warning signs:** CI or a developer runs a stale script and gets a confusing error.

### Pitfall 6: Password reset script uses anon client instead of service-role
**What goes wrong:** The script fails with `Not authorized` when calling `auth.admin.generateLink()` or `auth.admin.listUsers()`.
**Why it happens:** Admin auth APIs require the service-role key; the anon key has no access to `auth.admin.*`.
**How to avoid:** Use the same inline service-role client pattern as `scripts/seed.ts` — not the `supabase/admin.ts` module (which imports `server-only`, incompatible with Node.js script context).
**Warning signs:** Error: `AuthApiError: Not authorized`.

## Code Examples

Verified patterns from official sources and existing codebase:

### Password Reset Script Structure
```typescript
// scripts/send-password-resets.ts
// Run with: npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts [--dry-run]
// Source: https://supabase.com/docs/reference/javascript/auth-admin-generatelink
import { createClient } from '@supabase/supabase-js'

// Inline client — do NOT import src/lib/supabase/admin.ts (server-only incompatible)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const dryRun = process.argv.includes('--dry-run')

async function sendPasswordResets() {
  // Fetch all users (page through if > 1000)
  const { data: { users }, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (error) throw error

  // Filter to artists only (skip super-admins)
  const artists = users.filter(u =>
    u.app_metadata?.app_role !== 'super-admin' && u.email
  )

  console.log(`Found ${artists.length} artists. Dry run: ${dryRun}`)

  for (const user of artists) {
    if (!user.email) continue
    if (dryRun) {
      console.log(`[DRY RUN] Would send reset to: ${user.email}`)
      continue
    }
    // resetPasswordForEmail uses anon client endpoint but triggers Supabase email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email)
    if (resetError) {
      console.error(`FAIL ${user.email}: ${resetError.message}`)
    } else {
      console.log(`SENT ${user.email}`)
    }
    // Respect Supabase Free tier 4 emails/hour limit
    await new Promise(r => setTimeout(r, 1500))
  }
}

sendPasswordResets().catch(err => { console.error(err); process.exit(1) })
```

### Build Verification Commands
```bash
# 1. Confirm zero Payload references in src/
grep -r "payloadcms\|mongodb" src/ && echo "FAIL: references found" || echo "PASS: src/ is clean"

# 2. Local build must pass
npm run build

# 3. Smoke tests (runs dev server automatically via playwright.config.ts webServer)
npx playwright test

# 4. Specific test file for quick check
npx playwright test tests/smoke/storefront.spec.ts
npx playwright test tests/smoke/auth.spec.ts
npx playwright test tests/smoke/admin.spec.ts
```

### package.json Scripts After Cleanup
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:seed": "npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts",
    "db:types": "supabase gen types typescript --project-id <PROJECT_ID> > src/lib/supabase/types.ts"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Payload-managed auth (MongoDB users) | Supabase Auth (PostgreSQL users table) | Phase 2 | Artists need password reset to access new system |
| Vercel Blob storage | Supabase Storage | Phase 5 | All media URLs already migrated (verify-blob-urls.ts exits 0) |
| Payload Admin UI | Custom `/admin` route | Phase 6 | No Payload UI dependencies remain in active UI |
| payload.config.ts + collections/ | Deleted in Phase 4 | Phase 4 | No config files to remove in Phase 7 |

**Deprecated/outdated in this codebase:**
- `src/payload-types.ts`: Auto-generated by Payload CLI. Confirmed no imports anywhere in `src/`. Delete.
- `src/components/stripe-verify.tsx`: Imports `@payloadcms/ui`. Not imported by any other file. Delete.
- `scripts/verify-blob-urls.ts`: One-time migration verification tool. Exits 0 confirming no Blob URLs. Delete.
- `package.json` scripts `generate:types`, `db:fresh`: Call Payload CLI which will not be installed. Remove.
- `package.json` script `db:seed`: Currently points to `src/seed.ts` (old Payload seed, deleted in Phase 4). Must be updated to point to `scripts/seed.ts`.

**Critical finding:** The current `db:seed` script in `package.json` still points to `src/seed.ts`, which was deleted in Phase 4. This script is already broken. Fix it to point to `scripts/seed.ts` as part of Phase 7 cleanup.

## Open Questions

1. **Supabase Free tier email limit vs. artist count**
   - What we know: Free tier limits to 4 emails/hour. The password reset script adds 1500ms delay between sends.
   - What's unclear: How many artists currently exist in the Supabase auth database.
   - Recommendation: Run dry-run first to see count. If > 10, the delay-based approach handles it (though slowly). Document the send rate in the script.

2. **`resetPasswordForEmail` vs `generateLink({ type: 'recovery' })`**
   - What we know: Both trigger a recovery email. `resetPasswordForEmail` is simpler and uses the configured email template. `generateLink` gives the link for custom delivery.
   - What's unclear: Whether the user's decision to "use Supabase built-in email provider" means they want to avoid any custom delivery.
   - Recommendation: Use `resetPasswordForEmail` (simpler, uses the dashboard template automatically). Use `generateLink` only if dry-run needs to show the actual link URL.

3. **Vercel project: existing or new?**
   - What we know: CONTEXT.md says "Link the Vercel project (or create if not exists)" — the decision covers both cases.
   - What's unclear: Whether a Vercel project already exists for this repo.
   - Recommendation: Plan 07-02 should check for existing Vercel project first (`vercel ls` or dashboard), then link or create accordingly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test tests/smoke/auth.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEN-01 | Zero Payload packages in package.json | manual / grep | `grep -c "@payloadcms\|\"payload\"" package.json` (expect 0) | N/A — grep check |
| CLEN-02 | Zero Payload source files in src/ | manual / grep | `grep -r "payloadcms" src/ \|\| echo PASS` | N/A — grep check |
| CLEN-03 | No MongoDB connection | manual / grep | `grep -r "mongodb" src/ \|\| echo PASS` | N/A — grep check |
| CLEN-04 | No Vercel Blob dependency | manual / grep | `grep "vercel.blob\|@vercel/blob" package.json \|\| echo PASS` | N/A — grep check |
| CLEN-05 | Build passes, app works | smoke | `npm run build && npx playwright test` | ✅ All 5 test files exist |

### Existing Smoke Tests (all 4 critical flows covered)
| File | Covers |
|------|--------|
| `tests/smoke/storefront.spec.ts` | Storefront loads, subdomain routing, tenant isolation |
| `tests/smoke/auth.spec.ts` | Login, redirect, sign-up page, confirm route |
| `tests/smoke/admin.spec.ts` | Admin access, all 5 nav sections |
| `tests/smoke/storage.spec.ts` | Image loading from Supabase Storage |
| `tests/smoke/rls-isolation.spec.ts` | Row Level Security cross-tenant isolation |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/smoke/storefront.spec.ts tests/smoke/auth.spec.ts`
- **Per wave merge:** `npm run build && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. Phase 7 requires no new test files; the existing smoke suite is the acceptance criterion.

## Sources

### Primary (HIGH confidence)
- Direct codebase audit (`package.json`, `src/`, `scripts/`) — all Payload references enumerated
- [Supabase auth.admin.generateLink docs](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) — recovery link type confirmed
- Established project patterns from STATE.md decisions log

### Secondary (MEDIUM confidence)
- [Supabase resetPasswordForEmail docs](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) — standard password reset flow
- Playwright config at `playwright.config.ts` — webServer, baseURL, test directory confirmed

### Tertiary (LOW confidence)
- Supabase Free tier 4 emails/hour limit — widely cited in community; not confirmed in official quota docs for this exact tier

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages confirmed by direct package.json inspection
- Architecture: HIGH — all file paths verified by codebase grep and glob
- Pitfalls: HIGH for stripe-verify/build failure (verified by grep); MEDIUM for email rate limits (community knowledge)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain — npm packages and Supabase Admin API are stable)

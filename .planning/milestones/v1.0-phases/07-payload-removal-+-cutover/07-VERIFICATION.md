---
phase: 07-payload-removal-+-cutover
verified: 2026-03-12T00:00:00Z
status: gaps_found
score: 6/8 must-haves verified
re_verification: false
gaps:
  - truth: "All existing artists have received a password reset email and can log into the Supabase-backed platform"
    status: partial
    reason: "1 of 3 seed artist accounts (artist1@test.ferment.com) did not receive a reset email — Supabase Free tier rate limit (4/hour) blocked the third send. Re-run pending."
    artifacts:
      - path: "scripts/send-password-resets.ts"
        issue: "Script itself is correct and wired; the live run produced 2 SENT and 1 FAIL. The FAIL account has not received its reset email."
    missing:
      - "Re-run the script after the Supabase rate-limit window resets: npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts"
      - "Confirm SENT line for artist1@test.ferment.com appears in output"
  - truth: "The production application serves the marketplace correctly — storefronts load, checkout works, images display — with no Payload or MongoDB in the dependency tree"
    status: partial
    reason: "Smoke test suite ran 7/19 passing against production. 4 storefront tests hardcode http://ceramics-by-ana.localhost:3000/ (cannot run against production), and 6 admin-panel tests fail due to cookie domain mismatch: NEXT_PUBLIC_ROOT_DOMAIN is set to a custom domain but the production URL is ferment-platforma.vercel.app, causing client-side auth cookies to be rejected by the browser. Checkout (2/2) and basic auth render (4/5) pass."
    artifacts:
      - path: "src/lib/supabase/client.ts"
        issue: "Sets cookie domain to .${NEXT_PUBLIC_ROOT_DOMAIN} in production. When NEXT_PUBLIC_ROOT_DOMAIN is a custom domain (e.g. ferment.com), cookies are rejected on ferment-platforma.vercel.app — client-side auth fails silently."
      - path: "tests/smoke/storefront.spec.ts"
        issue: "All 4 tests hardcode http://ceramics-by-ana.localhost:3000/ — structurally cannot validate production storefront subdomain routing."
    missing:
      - "Either configure a custom domain on Vercel matching NEXT_PUBLIC_ROOT_DOMAIN, OR update src/lib/supabase/client.ts to skip cookie domain setting when running on *.vercel.app"
      - "Update storefront smoke tests to use a production subdomain URL once custom domain + wildcard DNS is configured"
      - "Re-run full smoke suite against production after domain fix to confirm all flows green"
human_verification:
  - test: "Confirm artist1@test.ferment.com reset email re-sent"
    expected: "After re-running the script, artist1@test.ferment.com receives a password reset email with migration-specific copy and a working reset link"
    why_human: "Requires waiting for Supabase Free tier rate-limit window to reset, then running the script and checking email delivery in Supabase Auth Logs"
  - test: "Admin panel functional on production after domain fix"
    expected: "Log in as super-admin at ferment-platforma.vercel.app (or custom domain), navigate to /admin, all sections (merchants, products, orders) load with real data"
    why_human: "Requires domain configuration and a real browser login to verify cookie handling and server-side data queries"
  - test: "Artist storefront renders on production with Supabase Storage images"
    expected: "Visiting an artist subdomain on the production domain shows products with images loaded from Supabase Storage URLs"
    why_human: "Requires wildcard DNS + custom domain configuration before this is verifiable; hardcoded localhost tests cannot substitute"
---

# Phase 7: Payload Removal + Cutover — Verification Report

**Phase Goal:** Payload CMS is fully removed from the codebase, existing artists have received password reset emails, and the application is live on Supabase with no Payload code or MongoDB connection remaining
**Verified:** 2026-03-12
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run build` completes with zero errors and zero Payload/MongoDB references in build output | VERIFIED | Summary confirms build exits 0, all 13 static pages generated; confirmed by commit da0024e |
| 2 | `grep -r "payloadcms" src/` returns zero matches | VERIFIED | Live grep against codebase returns zero matches |
| 3 | `package.json` contains zero `@payloadcms/*`, `payload`, `mongodb`, `graphql` entries | VERIFIED | Live grep of package.json returns zero matches; full dependency list confirmed clean |
| 4 | Broken Payload CLI scripts (`generate:types`, `db:fresh`) removed; `db:seed` points to `scripts/seed.ts` | VERIFIED | Live check confirms scripts absent; db:seed confirmed pointing to `scripts/seed.ts` |
| 5 | Vercel project linked and production deployment live | VERIFIED | `.vercel/project.json` exists; summary documents `vercel --prod` exit 0 at https://ferment-platforma.vercel.app; server-side Supabase queries return real data (count: 20 products) |
| 6 | Password reset script exists with `--dry-run` support, service-role client, and super-admin exclusion | VERIFIED | `scripts/send-password-resets.ts` exists; code confirms all required patterns present and wired |
| 7 | All existing artists have received a password reset email | PARTIAL | Script ran: 2/3 artists received email (SENT artist3, artist2); artist1@test.ferment.com hit rate limit (FAIL: email rate limit exceeded). Re-run pending. |
| 8 | Production application serves marketplace correctly — storefronts load, checkout works, admin accessible | PARTIAL | Checkout (2/2) and auth page rendering (4/5) pass. Admin (1/7) fails: cookie domain mismatch between NEXT_PUBLIC_ROOT_DOMAIN and ferment-platforma.vercel.app. Storefront (0/4) blocked: tests hardcode localhost subdomain URL. |

**Score:** 6/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Cleaned dependencies + scripts | VERIFIED | Zero @payloadcms/*, payload, mongodb, graphql; broken scripts removed; db:seed fixed |
| `src/components/stripe-verify.tsx` | Deleted | VERIFIED | File absent; confirmed by git commit 30b8648 |
| `src/payload-types.ts` | Deleted | VERIFIED | File absent; confirmed by git commit 30b8648 |
| `scripts/verify-blob-urls.ts` | Deleted | VERIFIED | File absent; confirmed by git commit 30b8648 |
| `playwright.config.ts` | PLAYWRIGHT_BASE_URL override added | VERIFIED | Lines 15 and 24 contain override; confirmed by grep |
| `tests/smoke/checkout.spec.ts` | Checkout smoke test (2 tests) | VERIFIED | File exists; 2 tests confirmed passing against production (2/2) |
| `scripts/send-password-resets.ts` | Dry-run/live script with service-role client | VERIFIED | File exists; implementation fully matches plan spec |
| `.vercel/project.json` | Vercel project link | VERIFIED | File exists locally (gitignored) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `npm run build` | No unresolved Payload module imports | VERIFIED | Build passes cleanly; no Payload module resolution errors |
| `playwright.config.ts` | Production baseURL | `process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'` | VERIFIED | Pattern present at line 15; webServer skipped when env var set (line 24) |
| `scripts/send-password-resets.ts` | `supabase.auth.admin.listUsers` | Inline `createClient` with `SUPABASE_SERVICE_ROLE_KEY` | VERIFIED | Code uses `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, ...)` |
| `supabase.auth.resetPasswordForEmail` | Supabase email template | Supabase built-in SMTP relay | VERIFIED | `resetPasswordForEmail(user.email)` present in loop body; live run produced SENT lines confirming relay functional |
| `src/lib/supabase/client.ts` | Production auth cookies | Cookie domain set to `.${NEXT_PUBLIC_ROOT_DOMAIN}` | PARTIAL | Wired correctly for custom domain, but breaks on vercel.app subdomain — cookies rejected when domains mismatch |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLEN-01 | 07-01 | All Payload CMS packages removed from `package.json` | SATISFIED | Zero @payloadcms/*, payload, mongodb, graphql in package.json — live verified |
| CLEN-02 | 07-01 | Payload configuration and collection files removed | SATISFIED | payload.config.ts absent; src/collections/ absent; src/payload-types.ts deleted; src/components/stripe-verify.tsx deleted |
| CLEN-03 | 07-01 | MongoDB connection removed | SATISFIED | @payloadcms/db-mongodb removed from package.json; no mongodb references in src/ |
| CLEN-04 | 07-01 | Vercel Blob dependency removed | SATISFIED | @payloadcms/storage-vercel-blob and @vercel/blob absent from package.json |
| CLEN-05 | 07-02, 07-03 | App builds and runs successfully with zero Payload references | PARTIAL | Build passes (CLEN-05 core satisfied). Production deployment live. Full smoke suite not green: 11/19 tests fail due to domain mismatch and localhost-hardcoded storefront tests. Checkout and basic auth rendering confirmed working. |

### Orphaned Requirement Note

**AUTH-05** ("All existing artists receive a password reset email so they can log in after migration") is mapped to Phase 2 in REQUIREMENTS.md with status "Pending". The implementation was delivered in Phase 7 Plan 03. The REQUIREMENTS.md traceability table has not been updated to reflect this. AUTH-05 is not claimed in any Phase 7 plan's `requirements:` frontmatter field — it was implemented but not formally claimed.

This is a documentation gap, not a functional gap. The script exists, it ran, and 2/3 seed artists received emails. However AUTH-05 status in REQUIREMENTS.md still shows "Pending" under Phase 2.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `package.json` | 12 | `<PROJECT_ID>` placeholder in `db:types` script | Info | Intentional — user must fill in their Supabase project ID before using `npm run db:types`. Documented in 07-01-SUMMARY.md under "User Setup Required". Does not affect build or runtime. |
| `tests/smoke/storefront.spec.ts` | 13, 17, 23, 31, 38 | Hardcoded `http://ceramics-by-ana.localhost:3000/` — cannot run against production | Warning | All 4 storefront smoke tests are structurally unable to validate production subdomain routing. Pre-existing issue carried forward from earlier phases; not introduced by Phase 7. Requires custom domain + wildcard DNS to fix. |

---

## Human Verification Required

### 1. Re-send password reset to artist1

**Test:** After the Supabase Free tier rate-limit window resets (1 hour from last send), run `npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts`
**Expected:** Output shows `SENT artist1@test.ferment.com` and ends with `Done.`; Supabase Dashboard → Authentication → Logs shows the email dispatch event; the artist receives an email with a working reset link
**Why human:** Requires waiting for the rate-limit window and then checking Supabase Auth Logs for delivery confirmation

### 2. Admin panel accessible on production

**Test:** Open https://ferment-platforma.vercel.app in a browser, attempt to log in as super-admin, navigate to /admin
**Expected:** Login succeeds, session persists on refresh, /admin shows merchants/products/orders tabs with real data loaded
**Why human:** Cannot verify programmatically — client-side cookie domain mismatch must be fixed (or custom domain configured) first; requires a real browser to observe auth cookie behavior

### 3. Storefront subdomain rendering on production

**Test:** Once a custom domain with wildcard DNS is configured on Vercel, visit an artist subdomain (e.g., ceramics-by-ana.yourdomain.com)
**Expected:** Storefront loads, product images display with Supabase Storage URLs (not Vercel Blob or missing), tenant isolation is correct (only that artist's products show)
**Why human:** Requires DNS/domain configuration before this is testable; cannot be verified via localhost

---

## Gaps Summary

Two observable truths are partially achieved:

**Gap 1 — Incomplete artist notification (Truth 7):** The password reset script ran correctly but hit Supabase Free tier rate limits — 2 of 3 seed artist accounts received emails. The third account (artist1@test.ferment.com) received a `FAIL: email rate limit exceeded` error. This is a pending re-run, not a broken script. Resolution is simple: wait for the rate window and re-run the same command.

**Gap 2 — Production smoke tests not fully green (Truth 8):** The production deployment is live and Supabase is connected (server-side queries confirmed working). However, the full smoke test suite is 7/19 passing:
- Checkout (2/2) — confirmed working
- Auth page rendering (4/5) — confirmed working
- Admin panel (1/7) — failing because client-side auth cookies are rejected on `ferment-platforma.vercel.app` due to `NEXT_PUBLIC_ROOT_DOMAIN` being set to a custom domain. This is a configuration issue in `src/lib/supabase/client.ts`, not a code regression.
- Storefront (0/4) — test structural limitation (hardcoded localhost URLs); not a production failure

The core phase goal — Payload removed, build passes, Supabase live — is achieved. The gaps are operational: one pending re-send and one domain-configuration-dependent auth issue. The application is functional for checkout and read-only browsing; admin and subdomain features require domain setup to validate.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_

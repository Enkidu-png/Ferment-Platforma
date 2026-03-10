---
phase: 5
slug: storage-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (already configured) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test tests/smoke/storefront.spec.ts --project=chromium` |
| **Full suite command** | `npx playwright test --project=chromium` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/smoke/storefront.spec.ts --project=chromium`
- **After every plan wave:** Run `npx playwright test --project=chromium`
- **Before `/gsd:verify-work`:** Full suite must be green + `npx tsx --env-file=.env.local scripts/verify-blob-urls.ts` must exit 0
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-W0-01 | Wave 0 | 0 | STOR-01, STOR-04 | smoke | `npx playwright test tests/smoke/storage.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 5-W0-02 | Wave 0 | 0 | STOR-02, STOR-03 | smoke (SQL) | `npx tsx --env-file=.env.local scripts/verify-blob-urls.ts` | ❌ W0 | ⬜ pending |
| 5-01-01 | 01 | 1 | STOR-01 | smoke | `npx playwright test tests/smoke/storage.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | STOR-02, STOR-03 | smoke (SQL) | `npx tsx --env-file=.env.local scripts/verify-blob-urls.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | STOR-04 | smoke | `npx playwright test tests/smoke/storage.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | STOR-05 | smoke | `npx tsx --env-file=.env.local scripts/seed.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/smoke/storage.spec.ts` — stubs for STOR-01 (bucket accessible/public-read) and STOR-04 (product image renders via Next.js `<Image>`)
- [ ] `scripts/verify-blob-urls.ts` — SQL verification script for STOR-02 and STOR-03; exits non-zero if any `blob.vercel-storage.com` URLs found in database

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage RLS INSERT policy allows authenticated artists to upload to own tenant folder | STOR-01 | RLS bypass by service-role seed — policies untested by automated tests | In Supabase dashboard, verify policies exist on `storage.objects` for `media` bucket; check `pg_policies` view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

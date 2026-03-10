---
phase: 6
slug: custom-admin-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (already configured) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test tests/smoke/admin.spec.ts` |
| **Full suite command** | `npx playwright test tests/smoke/` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/smoke/admin.spec.ts`
- **After every plan wave:** Run `npx playwright test tests/smoke/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | ADMN-01 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "redirects"` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 0 | ADMN-01 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "non-admin"` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | ADMN-01 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "renders admin"` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | ADMN-02 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "pending tab"` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | ADMN-02 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "approve"` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | ADMN-04 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "products table"` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 2 | ADMN-05 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "category create"` | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 2 | ADMN-06 | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "orders"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/smoke/admin.spec.ts` — stubs covering ADMN-01 through ADMN-06 (full file creation)
- [ ] Requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars (already used in `tests/smoke/auth.spec.ts` — confirmed available)

*Note: `tests/smoke/admin.spec.ts` does not yet exist — Wave 0 must create it.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reject button immediately blocks merchant shop visibility | ADMN-02 | Requires visual storefront check after rejection | 1. Approve a test merchant to active. 2. Return to admin and reject them. 3. Visit their storefront URL — should show 404 or redirect. |
| Category rename reflected in buyer-facing filter dropdown | ADMN-05 | Requires cross-page UI verification | 1. Rename a category in admin. 2. Navigate to buyer shop page. 3. Confirm filter dropdown shows updated name. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

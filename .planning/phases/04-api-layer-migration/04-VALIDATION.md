---
phase: 4
slug: api-layer-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing) + TypeScript compiler |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx playwright test --reporter=list` |
| **Estimated runtime** | ~60 seconds (Playwright) / ~10 seconds (tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx playwright test --reporter=list`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds (tsc) / 60 seconds (Playwright)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 4-01-01 | 01 | 1 | API-01 | compile | `npx tsc --noEmit` | ⬜ pending |
| 4-01-02 | 01 | 1 | API-01 | compile | `npx tsc --noEmit` | ⬜ pending |
| 4-01-03 | 01 | 1 | API-02 | compile | `npx tsc --noEmit` | ⬜ pending |
| 4-02-01 | 02 | 2 | API-03 | compile | `npx tsc --noEmit` | ⬜ pending |
| 4-02-02 | 02 | 2 | API-04 | compile | `npx tsc --noEmit` | ⬜ pending |
| 4-03-01 | 03 | 3 | API-05 | e2e | `npx playwright test --reporter=list` | ⬜ pending |
| 4-03-02 | 03 | 3 | API-06 | e2e | `npx playwright test --reporter=list` | ⬜ pending |
| 4-03-03 | 03 | 3 | API-07 | compile | `npx tsc --noEmit` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — Playwright and TypeScript compiler already installed and configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe webhook creates order in Supabase | API-05 | Requires real Stripe test event or CLI trigger | Run `stripe trigger checkout.session.completed` with test card, verify `orders` row in Supabase dashboard |
| Artist subdomain shows only their products | API-01 | RLS isolation check | Log in as artist A, visit artist B's subdomain — product list must be empty |
| isSuperAdmin grants correct access | API-07 | Role-based access | Sign in as super-admin user, verify admin-only procedures succeed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

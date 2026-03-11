---
phase: 7
slug: payload-removal-cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing smoke tests) + TypeScript compiler |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx playwright test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (tsc check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | CLEN-01 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | CLEN-01 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 1 | CLEN-02 | compile | `npm run build` | ✅ | ⬜ pending |
| 7-02-01 | 02 | 2 | CLEN-02 | e2e | `npx playwright test` | ✅ | ⬜ pending |
| 7-02-02 | 02 | 2 | CLEN-03 | e2e | `npx playwright test` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 3 | CLEN-04 | manual | deploy + verify | ❌ manual | ⬜ pending |
| 7-03-02 | 03 | 3 | CLEN-05 | manual | send + confirm receipt | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*No new test files needed — existing Playwright smoke tests cover all 4 critical flows (storefront, auth, admin, checkout). TypeScript compiler provides build-time feedback for cleanup tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel deploy succeeds in production | CLEN-04 | Requires live deployment | Run `vercel --prod`, check deployment URL |
| Password reset emails received by artists | CLEN-05 | Requires real email inboxes | Run dry-run first, then live; confirm at least 1 test account receives email |
| Storefront loads in production | CLEN-04 | Requires live environment | Visit artist subdomain in browser, verify images load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 02-auth-migration
plan: "02"
subsystem: auth/middleware
tags: [supabase, cookies, middleware, subdomain, ssr]
dependency_graph:
  requires: []
  provides: [subdomain-cookie-sharing, supabase-session-middleware]
  affects: [src/middleware.ts, src/lib/supabase/middleware.ts, src/lib/supabase/server.ts, src/lib/supabase/client.ts]
tech_stack:
  added: []
  patterns: [cookie-domain-sharing, header-mutation-rewrite, supabase-ssr-pattern]
key_files:
  created: []
  modified:
    - src/middleware.ts
    - src/lib/supabase/middleware.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
decisions:
  - "Use x-middleware-rewrite header mutation instead of NextResponse.rewrite() to preserve Supabase session cookies"
  - "cookieOptions undefined in development so Supabase defaults apply correctly for localhost"
  - "Leading dot in .${ROOT_DOMAIN} ensures all subdomains share the auth cookie"
metrics:
  duration: "3 minutes"
  completed: "2026-03-06"
  tasks_completed: 2
  files_modified: 4
---

# Phase 2 Plan 02: Supabase Middleware + Subdomain Cookie Config Summary

**One-liner:** Composed Supabase session refresh with subdomain routing via header mutation, and configured .ferment.com domain cookies across all three Supabase client factories.

## What Was Done

Added subdomain-aware cookie options to all three Supabase client factories so a single auth session is shared across `ferment.com` and all artist subdomains (e.g. `artist.ferment.com`). The cookie domain is set to `.${NEXT_PUBLIC_ROOT_DOMAIN}` in production and left undefined (Supabase defaults) in development.

Rewrote `src/middleware.ts` to call `updateSession()` from the Supabase SSR middleware first, capturing its response object. Subdomain routing is then applied by mutating that same response via the `x-middleware-rewrite` header — never by creating a new `NextResponse`. This ensures the refreshed session cookies that `updateSession()` writes are never discarded.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/supabase/middleware.ts` | Added `cookieOptions` with `.ROOT_DOMAIN` production config; passed alongside `cookies:` in `createServerClient` options |
| `src/lib/supabase/server.ts` | Same `cookieOptions` pattern added before `createServerClient` call |
| `src/lib/supabase/client.ts` | `cookieOptions` passed as third argument `{ cookieOptions }` to `createBrowserClient` |
| `src/middleware.ts` | Full rewrite: calls `updateSession()`, mutates response via `x-middleware-rewrite` header for subdomain routing |

## Key Decisions / Notes

**Why x-middleware-rewrite header, not NextResponse.rewrite()**

`updateSession()` in `@supabase/ssr` creates the response object and writes refreshed auth cookies onto it. If we call `NextResponse.rewrite()` after that, we create a brand-new response and those cookies are lost — the user gets logged out. Mutating `supabaseResponse.headers.set("x-middleware-rewrite", ...)` applies the URL rewrite while keeping all cookie state intact.

**Why cookieOptions is undefined in development**

In development the app runs on `localhost`. Setting `domain: .ferment.com` on localhost cookies would cause browsers to reject them. Passing `undefined` lets Supabase use its defaults, which work correctly with localhost.

**Pre-existing TypeScript errors**

`npx tsc --noEmit` reports errors in `sign-in-view.tsx`, `sign-up-view.tsx`, and `categories/server/procedures.ts`. These are pre-existing issues from earlier phases (tRPC procedure shape mismatches) that are out of scope for this plan. Zero errors exist in the four files modified by this plan.

## Verification Result

```
$ npx tsc --noEmit 2>&1 | grep -E "src/middleware\.ts|src/lib/supabase/middleware\.ts|src/lib/supabase/server\.ts|src/lib/supabase/client\.ts"
(no output — zero errors in modified files)
```

All four modified files pass TypeScript checking.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/middleware.ts
- FOUND: src/lib/supabase/middleware.ts
- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/client.ts
- FOUND: .planning/phases/02-auth-migration/02-02-SUMMARY.md

Commits:
- FOUND: 5828cb5 (Task 1 — cookie options)
- FOUND: a7798fc (Task 2 — middleware rewrite)

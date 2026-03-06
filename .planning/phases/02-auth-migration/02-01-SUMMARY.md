---
phase: 02-auth-migration
plan: "01"
subsystem: trpc-auth
tags: [trpc, supabase, auth, context]
depends_on: []
provides: [supabase-trpc-context, auth-session-procedure]
affects: [all-trpc-routers]
tech_stack:
  added: []
  patterns: [supabase-ssr-server-client, trpc-context-factory]
key_files:
  created: []
  modified:
    - src/trpc/init.ts
    - src/modules/auth/server/procedures.ts
    - src/modules/auth/schemas.ts
  deleted:
    - src/modules/auth/utils.ts
decisions:
  - "Use getUser() not getSession() — getSession() does not validate JWT server-side"
  - "createClient() is async so must be awaited inside createTRPCContext"
  - "baseProcedure has no middleware — Supabase client injected via createTRPCContext"
metrics:
  duration_seconds: 146
  completed: 2026-03-06
  tasks_completed: 2
  files_changed: 4
---

# Phase 02 Plan 01: tRPC Supabase Context + Auth Procedures Summary

**One-liner:** Replaced Payload tRPC context with Supabase server client; `ctx.supabase` + `ctx.user` via `getUser()`; auth router reduced to a single session query.

## What Was Done

Rewrote the tRPC foundation to use Supabase instead of Payload as the database/auth provider.

**Task 1 — `src/trpc/init.ts` rewrite:**
- Removed all Payload imports (`getPayload`, `payload/config`, `next/headers`)
- `createTRPCContext` now calls `createClient()` (async Supabase SSR client), then `supabase.auth.getUser()` to validate the JWT server-side
- Returns `{ supabase, user }` — available to every procedure via `ctx`
- `baseProcedure` is now a plain `t.procedure` with no injected middleware
- `protectedProcedure` guards on `ctx.user` presence; throws `UNAUTHORIZED` if absent

**Task 2 — auth module cleanup:**
- `procedures.ts` replaced the full Payload register/login/session router with a single `session` query returning `{ user: ctx.user ?? null }`
- `schemas.ts` renamed `username` field to `shopName` — same slug-safe regex, same validation logic, updated error messages
- `utils.ts` deleted — the Payload cookie helper (`generateAuthCookie`) is no longer needed; Supabase SSR handles cookie management automatically

## Files Changed

| File | Change |
|------|--------|
| `src/trpc/init.ts` | Full rewrite — Supabase context, no Payload |
| `src/modules/auth/server/procedures.ts` | Full rewrite — session-only router |
| `src/modules/auth/schemas.ts` | Renamed `username` → `shopName` |
| `src/modules/auth/utils.ts` | Deleted |

## Key Decisions / Notes

1. **`getUser()` over `getSession()`** — `getSession()` reads from the cookie without server-side JWT validation. `getUser()` makes a network call to Supabase Auth to verify the token. This is the correct pattern for server-side auth.

2. **`createClient()` is async** — The `@supabase/ssr` `createClient` function awaits `cookies()` from Next.js 15. Must be awaited inside `createTRPCContext`.

3. **No middleware on `baseProcedure`** — The Supabase client is always available via `ctx.supabase` (injected by `createTRPCContext`), so no middleware wrapper is needed. This is simpler than the old Payload `baseProcedure.use(...)` pattern.

4. **Acceptable follow-on errors** — Other modules (`categories`, `checkout`, `sign-up-view`) still reference `ctx.db` (Payload) or `input.username`. These will be fixed in subsequent plans as intended.

## Verification Result

`npx tsc --noEmit` — no errors in the four modified/deleted files.

Errors exist in `sign-up-view.tsx` (references `input.username` — fixed in Plan 03) and in `categories` and `checkout` procedures (still reference `ctx.db` — fixed in later plans). These are expected and acceptable per plan success criteria.

## Deviations from Plan

None — plan executed exactly as written.

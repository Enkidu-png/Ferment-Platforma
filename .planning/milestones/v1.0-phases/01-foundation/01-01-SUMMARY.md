---
plan: 01-01
status: completed
completed_at: 2026-03-06
---

# Plan 01-01 Summary — Supabase Project Setup

## What was built
- Supabase project `ferment-platforma` provisioned in EU West (Ireland)
- Three env vars added to `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Installed `@supabase/supabase-js` and `@supabase/ssr`
- Created `src/lib/supabase/types.ts` (placeholder, replaced in Plan 03)
- Created `src/lib/supabase/server.ts` — Server Component / Route Handler client factory
- Created `src/lib/supabase/middleware.ts` — middleware session-refresh client factory
- Created `src/lib/supabase/client.ts` — Browser Client Component client factory
- Created `src/lib/supabase/admin.ts` — service role singleton (bypasses RLS, server-only)

## Verification
- `npx tsc --noEmit` — zero errors in `src/lib/supabase/`

## Notes
- RLS helper functions moved to `public` schema (`public.get_tenant_id()`, `public.is_super_admin()`) because Supabase restricts function creation in the `auth` schema via SQL editor / MCP

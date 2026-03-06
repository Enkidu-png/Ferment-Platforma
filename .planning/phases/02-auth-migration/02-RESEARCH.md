# Phase 2: Auth Migration - Research

**Researched:** 2026-03-06
**Domain:** Supabase Auth, @supabase/ssr, Next.js 15 middleware, tRPC context
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Login & Register UX
- Existing pages at `src/app/(app)/(auth)/sign-in/page.tsx` and `sign-up/page.tsx` must be rewired, not created from scratch
- Post-login redirect: always to artist dashboard
- Auth errors (wrong password, account not found): shown inline under the form
- Session is always persistent — no "remember me" checkbox

#### Session Behavior
- Silent token refresh via Supabase SSR; only redirect to sign-in if refresh fails
- Single session shared across all subdomains — cookie domain must be configured for `ferment.com` parent domain
- Session duration: Supabase default (7 days idle expiry)
- Password change signs out all active sessions on all devices

#### Existing Artists
- No existing artists to migrate — this phase has no migration concern
- Payload auth fallback is irrelevant — no real users yet

#### Registration & Onboarding
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

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with email and password via Supabase Auth | `signInWithPassword()` API; rewire existing `sign-in-view.tsx` to call Supabase directly instead of tRPC auth.login |
| AUTH-02 | User session persists across browser refresh (Supabase SSR cookies) | `@supabase/ssr` 0.9.0 handles this automatically via `updateSession()` in middleware; cookie options must include parent domain |
| AUTH-03 | Next.js middleware updated to compose Supabase session refresh with subdomain routing as a single Response pipeline | `updateSession()` returns `supabaseResponse`; subdomain rewrite applied by calling `supabaseResponse.headers.set("x-middleware-rewrite", ...)` on that same response object |
| AUTH-04 | tRPC context updated — `ctx.db` replaced with `ctx.supabase`, `protectedProcedure` uses Supabase `getUser()` | `createTRPCContext` creates server client; `protectedProcedure` calls `ctx.supabase.auth.getUser()` — never `getSession()` |
| AUTH-05 | All existing artists receive a password reset email so they can log in after migration | No-op in Phase 2 — no real users yet; deferred to Phase 7 |
| AUTH-06 | New artist can register and create a store (Supabase Auth account + tenants table row, status: pending) | `signUp()` with `options.data` for shop name metadata; email confirmation required; tenant row created in `/auth/confirm` route handler after PKCE code exchange |
</phase_requirements>

---

## Summary

Phase 2 replaces Payload's `ctx.db`-based auth with Supabase Auth across three integration layers: the tRPC context (init.ts), the Next.js middleware, and the UI views/procedures in `src/modules/auth/`. The existing `@supabase/ssr` 0.9.0 installation and the four client factory files from Phase 1 are the correct foundation — no new packages are needed. The async `cookies()` pattern is already correctly implemented in `src/lib/supabase/server.ts`.

The critical integration challenge is composing Supabase's `updateSession()` with the existing subdomain routing middleware in a single response pipeline. The pattern is to call `updateSession()` first (returns `supabaseResponse`), then apply the subdomain rewrite as a header modification on that same response object rather than creating a new `NextResponse`. This preserves the refreshed session cookies.

Registration requires an email confirmation PKCE callback route at `app/auth/confirm/route.ts`. After the user clicks the verification link, this route exchanges the token hash, then creates the `tenants` row with `status=pending` and redirects to a waiting page. The `shop_name` collected during signup is stored in Supabase user metadata (`options.data.shop_name`) so the callback handler can read it when creating the tenant row.

**Primary recommendation:** Compose the middleware by calling `updateSession()` and then mutating `supabaseResponse` for the subdomain rewrite — never create a second `NextResponse.rewrite()`. Inject `ctx.supabase` into tRPC context using the server client factory. Use `getUser()` (not `getSession()`) everywhere on the server.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.9.0 (installed) | Cookie-based SSR auth for Next.js | Official Supabase package; replaces deprecated `@supabase/auth-helpers-nextjs`; handles async cookies() in Next.js 15 |
| `@supabase/supabase-js` | 2.98.0 (installed) | Supabase client core | Required peer dependency of `@supabase/ssr` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.55.0 (installed) | Form state for sign-in/sign-up | Already in use in existing views — keep |
| `zod` | 4.x (installed) | Schema validation | Already used in `schemas.ts` — extend, don't replace |
| `sonner` | 2.x (installed) | Toast notifications | Already imported in views — keep for non-inline errors |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` cookie clients | Custom JWT cookie management | `@supabase/ssr` handles token refresh, rotation, PKCE flow; custom solutions miss edge cases |
| PKCE callback route for tenant creation | DB trigger `on_auth_user_created` | Trigger fires on every signup but can block signups if it errors; callback route gives explicit error handling and can access `raw_user_meta_data.shop_name` directly |
| `getUser()` in protectedProcedure | `getSession()` | `getSession()` reads the cookie without server-side JWT validation — a tampered cookie can spoof auth. Always use `getUser()` |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended File Changes

```
src/
├── lib/supabase/
│   ├── server.ts          # KEEP as-is — already correct for Next.js 15
│   ├── middleware.ts       # EXTEND — add cookieOptions.domain for subdomain sharing
│   ├── client.ts          # KEEP as-is
│   └── admin.ts           # KEEP as-is
├── trpc/
│   └── init.ts            # REWRITE — replace ctx.db with ctx.supabase + protectedProcedure
├── middleware.ts           # REWRITE — compose updateSession() with subdomain routing
├── modules/auth/
│   ├── schemas.ts          # EXTEND — add shopName field to registerSchema
│   ├── utils.ts            # DELETE — generateAuthCookie() is no longer needed
│   ├── server/
│   │   └── procedures.ts   # REWRITE — replace Payload calls with Supabase Auth calls
│   └── ui/views/
│       ├── sign-in-view.tsx   # REWIRE — call supabase.auth.signInWithPassword() directly
│       └── sign-up-view.tsx   # REWIRE — call supabase.auth.signUp() + add shopName field
└── app/
    ├── (app)/(auth)/
    │   ├── sign-in/page.tsx   # SIMPLIFY — remove session check using old caller pattern
    │   └── sign-up/page.tsx   # SIMPLIFY — remove session check using old caller pattern
    └── auth/
        └── confirm/
            └── route.ts   # CREATE NEW — PKCE token exchange + tenant row creation
```

### Pattern 1: Middleware Composition (Supabase + Subdomain Routing)

**What:** `updateSession()` must run first and its returned response object must be the single response carrier. The subdomain rewrite is applied by mutating that response with an `x-middleware-rewrite` header — not by creating a second `NextResponse.rewrite()`.

**When to use:** Always — this is the only safe pattern for combining Supabase cookie refresh with other routing logic.

**Example:**
```typescript
// Source: Supabase docs + Next.js discussion #84461 pattern
import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    "/((?!api/|_next/|_static/|_vercel|media/|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req: NextRequest) {
  // Step 1: Supabase session refresh — returns the response we MUST use
  const { supabaseResponse } = await updateSession(req);

  // Step 2: Apply subdomain routing on the SAME response object
  const hostname = req.headers.get("host") || "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

  if (hostname.endsWith(`.${rootDomain}`)) {
    const tenantSlug = hostname.replace(`.${rootDomain}`, "");
    const url = new URL(`/tenants/${tenantSlug}${req.nextUrl.pathname}`, req.url);
    supabaseResponse.headers.set("x-middleware-rewrite", url.toString());
  }

  return supabaseResponse;
}
```

**Critical constraint:** Never call `NextResponse.rewrite()` or `NextResponse.next()` after `updateSession()` — this would discard the refreshed session cookies.

### Pattern 2: tRPC Context with Supabase Client

**What:** `createTRPCContext` creates the server Supabase client and calls `getUser()` once. The client AND the user are both put in context. `protectedProcedure` middleware enforces the auth check.

**When to use:** This is the replacement for the current `ctx.db` (Payload) pattern.

**Example:**
```typescript
// Source: Supabase + tRPC community pattern; verified against official Supabase docs
import { initTRPC, TRPCError } from '@trpc/server';
import { createClient } from '@/lib/supabase/server';
import superjson from 'superjson';
import { cache } from 'react';

export const createTRPCContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// baseProcedure: no auth required (public routes, e.g. browsing products)
export const baseProcedure = t.procedure;

// protectedProcedure: throws 401 if not authenticated
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // narrowed: user is non-null
    },
  });
});
```

### Pattern 3: Registration with Email Confirmation (PKCE Flow)

**What:** `signUp()` submits the form. With email confirmation enabled, the response has `user` but `session: null`. The user is sent a verification email. When they click the link they are redirected to `/auth/confirm?token_hash=...&type=email`. The Route Handler exchanges the token, then creates the `tenants` row.

**Why this over a DB trigger:** DB triggers on `auth.users` can silently fail or block sign-ups. The Route Handler gives explicit error handling and can reliably read `raw_user_meta_data` to extract `shop_name`.

**Example — sign-up view mutation (client component):**
```typescript
// Source: Supabase signUp() API docs
const supabase = createClient(); // browser client
const { data, error } = await supabase.auth.signUp({
  email: values.email,
  password: values.password,
  options: {
    data: {
      shop_name: values.shopName,
    },
  },
});
// data.session will be null — email confirmation required
// Show "Check your email" message instead of redirecting
```

**Example — `/auth/confirm/route.ts`:**
```typescript
// Source: Supabase PKCE flow docs
import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'email' | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      // Create pending tenant row
      const shopName = data.user.user_metadata?.shop_name as string | undefined;
      await supabase.from('tenants').insert({
        name: shopName ?? data.user.email ?? 'New Store',
        slug: shopName?.toLowerCase().replace(/\s+/g, '-') ?? data.user.id,
        status: 'pending',
        // stripe_account_id omitted — created in Phase 4 or onboarding
      });

      return NextResponse.redirect(`${origin}/pending`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirmation_failed`);
}
```

### Pattern 4: Subdomain Cookie Configuration

**What:** `createServerClient` and `createBrowserClient` must both receive `cookieOptions.domain` set to `.ferment.com` (leading dot = all subdomains) in production. In development, omit the domain (localhost doesn't support subdomain cookies).

**Example — update to `src/lib/supabase/middleware.ts`:**
```typescript
// Source: Supabase cross-subdomain discussion #5742
const cookieOptions = process.env.NODE_ENV === 'production'
  ? { domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, path: '/', sameSite: 'lax' as const, secure: true }
  : undefined;

const supabase = createServerClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions,
    cookies: { getAll() { ... }, setAll(cookiesToSet) { ... } },
  }
);
```

Apply the same `cookieOptions` in `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` (browser client uses `createBrowserClient` which also accepts `cookieOptions`).

### Pattern 5: Auth Procedures Replacement

**What:** The `auth.session` query and `auth.login`/`auth.register` mutations in `procedures.ts` should be removed entirely. Login and registration now happen client-side via the browser Supabase client — no tRPC roundtrip needed. The `session` query can be a lightweight procedure that reads `ctx.user`.

**Example — new `auth.session` procedure:**
```typescript
export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    return { user: ctx.user ?? null };
  }),
});
```

The sign-in and sign-up views bypass tRPC entirely and call `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()` from a browser client instance.

### Anti-Patterns to Avoid

- **Using `getSession()` on the server:** Does not validate the JWT against Supabase servers — use `getUser()` always in server code.
- **Creating a new `NextResponse.next()` after `updateSession()`:** Discards refreshed cookies; the subdomain rewrite must be applied to `supabaseResponse`.
- **Creating tenant row in a DB trigger:** Triggers on `auth.users` can block sign-ups if they error; use the PKCE callback route instead.
- **Calling Supabase Auth via tRPC mutation on login:** Creates an unnecessary server roundtrip; Supabase Auth is designed to be called directly from the browser client.
- **Using `raw_user_meta_data` directly in RLS policies:** Read it through the JWT hook claims instead — the JWT hook embeds `tenant_id` and `app_role` for RLS, not `raw_user_meta_data`.
- **Not awaiting `createClient()` in server context:** `src/lib/supabase/server.ts` `createClient` is async (awaits `cookies()`); forgetting `await` causes silent failures in Next.js 15.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session refresh on every request | Custom JWT validation middleware | `updateSession()` from `@/lib/supabase/middleware` | Handles token rotation, cookie juggling, PKCE correctly |
| "Remember me" / persistent session | Custom cookie TTL logic | Supabase default session (7 days) | Already handled by `@supabase/ssr` |
| Auth state in React context | Custom auth context provider | `supabase.auth.onAuthStateChange()` or `getUser()` per-request | Supabase SDK handles real-time auth state |
| Email confirmation flow | Custom email verification tokens | Supabase built-in email confirmation + PKCE flow | Supabase handles token generation, email sending, and expiry |
| Password hashing | bcrypt wrapper | Supabase Auth service | Supabase handles hashing, salting, and upgrade paths |
| Cross-subdomain session sharing | Custom token forwarding | `cookieOptions.domain` on all Supabase clients | Browser cookie domain attribute handles this natively |

**Key insight:** Supabase Auth is a managed service. The only code needed is thin wrappers to connect the Next.js request/response cycle to Supabase's cookie management. Everything else (token generation, refresh, invalidation) is handled by the service.

---

## Common Pitfalls

### Pitfall 1: Subdomain Cookie Not Shared

**What goes wrong:** Session works on `ferment.com` but not on `artist.ferment.com` — user appears logged out on subdomain.
**Why it happens:** Cookie domain defaults to the exact hostname, not the parent domain. Supabase sets cookies without a domain attribute by default.
**How to avoid:** Set `cookieOptions.domain` to `.ferment.com` (with leading dot) in ALL three client factories: `server.ts`, `middleware.ts`, and `client.ts`. Use conditional logic — only in production, not in development.
**Warning signs:** Login works on root domain in production but subdomain routes show unauthenticated state.

### Pitfall 2: Middleware Discarding Refreshed Session Cookies

**What goes wrong:** Session expires after one request or silent refresh doesn't work, causing logout loops.
**Why it happens:** Custom routing code calls `NextResponse.next()` or `NextResponse.rewrite()` after `updateSession()`, creating a new response object that doesn't carry the refreshed cookies.
**How to avoid:** Always return `supabaseResponse` directly. Apply subdomain rewriting by setting `x-middleware-rewrite` header on `supabaseResponse`, never by creating a new response.
**Warning signs:** `Set-Cookie` headers appear in some requests but not all; session works once then expires immediately.

### Pitfall 3: Using getSession() Instead of getUser()

**What goes wrong:** Security vulnerability — malicious actors can forge JWT cookies that appear valid to `getSession()` but are rejected by Supabase's server-side validation.
**Why it happens:** `getSession()` decodes the JWT locally without contacting Supabase, making it fast but insecure for auth checks.
**How to avoid:** Always use `supabase.auth.getUser()` in middleware, `createTRPCContext`, and `protectedProcedure`. `getSession()` is acceptable only on the client for non-security-critical UI state.
**Warning signs:** Code with `await supabase.auth.getSession()` in server-side paths.

### Pitfall 4: Email Confirmation with No Callback Route

**What goes wrong:** User clicks confirmation email link, browser goes to `ferment.com/auth/confirm?token_hash=...` and gets a 404.
**Why it happens:** Supabase sends the user to `<siteURL>/auth/confirm` — this route must exist as a Next.js Route Handler.
**How to avoid:** Create `src/app/auth/confirm/route.ts` before enabling email confirmation in Supabase dashboard. The route must call `verifyOtp({ type, token_hash })`.
**Warning signs:** 404s on sign-up confirmation; "Email link is invalid or has expired" errors.

### Pitfall 5: Tenant Row Created Before Email Confirmation

**What goes wrong:** Tenant row exists in `tenants` table for a user who never confirms their email — ghost tenants accumulate.
**Why it happens:** If tenant creation happens in `signUp()` response handler instead of the confirmation callback.
**How to avoid:** Only create the `tenants` row in `/auth/confirm/route.ts`, after `verifyOtp()` succeeds. Never create it immediately on `signUp()`.
**Warning signs:** Unconfirmed users appearing in `tenants` table.

### Pitfall 6: shop_name Not Available at Tenant Creation Time

**What goes wrong:** When creating the tenant row in the `/auth/confirm` handler, `shop_name` is unavailable.
**Why it happens:** `shop_name` was not passed to `signUp()` via `options.data`.
**How to avoid:** Pass `options.data: { shop_name: values.shopName }` in the `signUp()` call. In the callback handler, read it from `data.user.user_metadata.shop_name`.
**Warning signs:** Tenants created with null/empty names; TypeScript errors accessing `user_metadata`.

### Pitfall 7: createClient() Not Awaited in tRPC Context

**What goes wrong:** TypeScript error or silent undefined — `supabase` is a Promise, not a client.
**Why it happens:** `createClient` in `src/lib/supabase/server.ts` is async (awaits `cookies()`). Forgetting `await` in `createTRPCContext` assigns the Promise.
**How to avoid:** `const supabase = await createClient();` in `createTRPCContext`.
**Warning signs:** `ctx.supabase.from is not a function` runtime errors; TypeScript type mismatch.

---

## Code Examples

Verified patterns from official sources:

### signInWithPassword (browser client, client component)

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
const supabase = createClient(); // from @/lib/supabase/client
const { data, error } = await supabase.auth.signInWithPassword({
  email: values.email,
  password: values.password,
});
if (error) {
  // Show inline error — error.message contains "Invalid login credentials" etc.
  setError(error.message);
  return;
}
router.push('/'); // redirect to dashboard
```

### signUp with metadata (browser client, client component)

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signup
const { data, error } = await supabase.auth.signUp({
  email: values.email,
  password: values.password,
  options: {
    data: {
      shop_name: values.shopName,
    },
  },
});
// With email confirmation ON: data.session is null, data.user is set
// Show "Check your email" message
```

### signOut (browser client)

```typescript
// Source: Supabase JS reference
const { error } = await supabase.auth.signOut();
router.push('/sign-in');
```

### protectedProcedure (tRPC init.ts)

```typescript
// Source: Supabase + tRPC community pattern, verified against tRPC authorization docs
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

### Session check in sign-in/sign-up page.tsx

```typescript
// Replaces old caller.auth.session() pattern
import { createClient } from '@/lib/supabase/server';

const Page = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');
  return <SignInView />;
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 — deprecated, removed 2024 | Already using correct package |
| `getSession()` in server code | `getUser()` in server code | Supabase security advisory 2024 | Must use `getUser()` for all server-side auth checks |
| `supabase.auth.getSession()` | `supabase.auth.getClaims()` (new name in docs) | 2025/2026 docs update | Functionally `getUser()` remains the recommended method; `getClaims()` is for local-only JWT validation |
| `createPagesBrowserClient` | `createBrowserClient` | 2023 | Already using correct API |
| Separate `setAll`/`getAll` cookie implementations | `@supabase/ssr` 0.8.0+ minimal cookie size option (`cookies.encode`) | 2025-11-26 | Optional optimization available |

**Deprecated/outdated in the current codebase:**
- `src/modules/auth/utils.ts` `generateAuthCookie()`: Payload-specific cookie generation — delete entirely
- `ctx.db.auth()`, `ctx.db.login()`, `ctx.db.create()` in procedures: All Payload calls — replace with Supabase equivalents
- `ctx.db.config.cookiePrefix`: Payload-specific — not needed

---

## Open Questions

1. **`tenants.slug` uniqueness constraint vs. generated slug from shop_name**
   - What we know: `tenants` table has a unique slug index (from Phase 1); shop_name is free text.
   - What's unclear: If two artists choose the same shop name (and thus the same slug), the insert will fail silently or throw. Need a slug uniqueness check before insert.
   - Recommendation: In the `/auth/confirm` handler, generate the slug from shop_name and check for conflicts; append a random suffix if taken. Or restrict shop_name to match the `registerSchema` username regex and rename the field from `username` to `shopName`.

2. **`tenants.stripe_account_id` NOT NULL constraint**
   - What we know: Phase 1 schema was built with Stripe integration in mind. The exact nullable constraint on `stripe_account_id` is unknown from summaries.
   - What's unclear: If `stripe_account_id` is NOT NULL, inserting a pending tenant without a Stripe account ID will fail.
   - Recommendation: Verify the column constraint via `supabase gen types` output before implementing the `/auth/confirm` handler. If NOT NULL, either create the Stripe account at registration time (current Payload behavior) or make the column nullable for now (pending tenants don't need Stripe until approved).

3. **tRPC caller in page.tsx session check**
   - What we know: `sign-in/page.tsx` and `sign-up/page.tsx` currently call `caller.auth.session()` which uses Payload.
   - What's unclear: After tRPC context is rewritten to use Supabase, the `caller` will work correctly — but the session check could also just call `createClient()` directly, bypassing tRPC entirely.
   - Recommendation: Replace the session check in both page.tsx files with a direct `createClient()` call and `getUser()` — simpler and avoids unnecessary tRPC overhead for a page guard.

4. **AUTH-05 scope in this phase**
   - What we know: AUTH-05 says "All existing artists receive a password reset email" — but CONTEXT.md says no artists exist.
   - What's unclear: Whether AUTH-05 should be marked complete-by-exemption or deferred to Phase 7.
   - Recommendation: Mark AUTH-05 as complete-by-exemption with a note: "No existing artists — password reset flow is Phase 7."

---

## Sources

### Primary (HIGH confidence)
- `@supabase/ssr` CHANGELOG.md (github.com/supabase/ssr) — version 0.9.0 confirmed stable, no breaking changes
- Supabase JavaScript reference (supabase.com/docs/reference/javascript/auth-signup) — signUp() with options.data metadata, session null behavior with email confirmation
- Supabase advanced guide (supabase.com/docs/guides/auth/server-side/advanced-guide) — getUser() vs getSession() security distinction, PKCE flow
- Supabase SSR Next.js guide (supabase.com/docs/guides/auth/server-side/nextjs) — updateSession() middleware pattern, proxy approach

### Secondary (MEDIUM confidence)
- Next.js discussion #84461 (github.com/vercel/next.js/discussions/84461) — middleware composition pattern: `supabaseResponse.headers.set("x-middleware-rewrite", ...)` verified by community
- GitHub discussion #5742 (github.com/orgs/supabase/discussions/5742) — cross-subdomain cookie domain configuration with `cookieOptions.domain`
- Dev.to T3 + Supabase article (dev.to/isaacdyor) — createTRPCContext with supabase client + getUser() pattern; matches official tRPC authorization docs

### Tertiary (LOW confidence)
- Medium article (the-shubham.medium.com) — general cookie-based auth workflow; cross-verified against official docs
- Vercel Next.js discussion #81445 — async cookies() error; resolved by awaiting cookies() (already done in project's server.ts)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/ssr` 0.9.0 is the current stable release; all libraries already installed
- Architecture patterns: HIGH — middleware composition pattern verified against Next.js discussion; tRPC context pattern verified against official tRPC docs + Supabase getUser() docs
- Pitfalls: HIGH — getSession() vs getUser() is officially documented security advisory; subdomain cookie pattern verified against official Supabase discussions; middleware response chain is verified behavior
- Open questions: MEDIUM — slug uniqueness and Stripe constraint are internal schema questions resolvable by inspecting Phase 1 output

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable APIs; `@supabase/ssr` pre-1.0 so check for updates monthly)

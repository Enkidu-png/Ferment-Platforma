# Phase 3: Seed + Verify — Research

**Researched:** 2026-03-06
**Domain:** Supabase Admin API (user creation), service-role seeding, Playwright smoke tests in Next.js 15
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Script execution**
- Single script: `scripts/seed.ts`, run with `npx tsx scripts/seed.ts`
- Uses Supabase service-role key (already in `.env`) to bypass RLS for bulk inserts
- No dry-run flag needed — script is idempotent (see Conflict handling below)
- No over-engineering: no CLI flags, no progress bars, no abstraction layers

**Super-admin account**
- Seed script creates one super-admin Supabase Auth user via the admin API
- Credentials stored in `.env.local` (e.g. `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) so they are not hardcoded
- The user gets `app_role = admin` via the JWT custom claims hook (set via user metadata or a direct `user_tenants` row with admin role)
- This account is the one used to access the Phase 6 `/admin` panel

**Test data**
- 3 test tenants (artists), each with a Supabase Auth user and a `tenants` row with `status = active`
- ~20 products distributed across tenants and categories — enough to verify category filtering, multi-tenant isolation, and storefront rendering
- Products span multiple categories so category browse pages render real results
- All test users get recognisable email addresses (e.g. `artist1@test.ferment.com`) and a shared test password stored in `.env.local`

**Conflict handling**
- Script checks if each record already exists before inserting (check-if-exists, skip if found)
- Idempotent: running the script twice produces no duplicates and no errors
- No wipe-and-reseed mode — too destructive during development

**Smoke tests**
- Playwright tests prepared for AI execution (not manual checklist)
- Tests cover the critical paths that Phases 1 and 2 rewired:
  - `/sign-in` renders and accepts credentials
  - `/sign-up` renders with shopName field
  - Subdomain routing: `artist1.localhost:3000` resolves storefront correctly
  - `/pending` page renders
  - `/auth/confirm` route responds (does not 404)
  - Storefront product listing returns seeded products for the correct tenant
  - Category filter returns only products in that category
- Tests run against the local dev server (`npm run dev`)

**MongoDB schema reference**
- No mismatch concerns raised — Phase 1 schema is assumed correct
- MongoDB collection names were the source of truth for Supabase table names; Phase 1 generated types confirm alignment
- If any mismatch is found during research, it is a Phase 4 concern (tRPC procedure rewrites), not Phase 3

### Claude's Discretion

- Playwright configuration approach and test file structure
- Exact category/subcategory data used for seeding (must match existing app code)
- FK insert order and idempotency implementation details

### Deferred Ideas (OUT OF SCOPE)

- None raised during discussion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Reinterpreted: seed script `scripts/seed.ts` creates admin + test artists + products + categories | Service-role client pattern, createUser API, idempotent upsert — all documented below |
| DATA-02 | Reinterpreted: idempotency — check-if-exists before each insert, no duplicates on re-run | `select → skip` pattern documented; slug-based existence check for categories/tenants |
| DATA-03 | Reinterpreted: all seeded data in correct FK order with relationships preserved | Insert order: auth users → users → tenants → user_tenants → categories → products |
| DATA-04 | Reinterpreted: stripe_account_id placeholder set correctly (empty string, NOT NULL constraint) | Confirmed: use `''` as placeholder per Phase 2 accumulated decision |
| DATA-05 | Reinterpreted: Playwright smoke tests verify app works end-to-end after Phase 1+2 rewiring | Playwright setup, config, test structure, subdomain testing — all documented below |
</phase_requirements>

---

## Summary

Phase 3 is a seed script plus smoke tests — not a data migration. The seed script (`scripts/seed.ts`) must be a standalone Node.js/tsx file that creates a complete working dataset from scratch using the Supabase service-role client. The smoke tests verify that Phases 1 and 2 actually work when the app runs against real seeded data.

The most important codebase findings: (1) `src/lib/supabase/admin.ts` already exists and creates a service-role client, but it imports `server-only` which will throw in a non-Next.js script context — the seed script must create its own service-role client inline, not import `admin.ts`. (2) The authoritative category taxonomy is already encoded in `src/seed.ts` (old Payload seed) — 8 parent categories, each with 4-5 subcategories — the new seed must use exactly these slugs since the categories router hardcodes them in a `customOrder` array. (3) `tenants.stripe_account_id` is NOT NULL with no default — use `''` (empty string) as the placeholder per the Phase 2 accumulated decision. (4) `user_tenants` has no `role` column — it is purely a join table (`user_id`, `tenant_id`). The super-admin role is expressed via `users.role = 'super-admin'`, not via `user_tenants`.

Playwright is not installed. The package.json has no `@playwright/test` entry and there is no `playwright.config.ts`. Both must be created in this phase. Playwright supports subdomain testing on localhost via the `baseURL` and `Host` header approach — full browser navigation to `http://artist1.localhost:3000` works in Chromium without special configuration.

**Primary recommendation:** Write `scripts/seed.ts` as a self-contained ESM file using an inline service-role client. Create `playwright.config.ts` pointing at `npm run dev`. Structure tests as one file per critical path, each independent and re-runnable.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.98.0` (already installed) | Service-role client for seeding + admin user creation | Already in `package.json`; `createClient` with service-role key bypasses RLS |
| `tsx` | latest | Run `scripts/seed.ts` directly without compiling | Zero-config TypeScript execution; `npx tsx` works without installing globally |
| `@playwright/test` | `^1.50.0` | Browser automation for smoke tests | Official Playwright package; includes test runner, assertions, and browser binaries |
| `dotenv` | built into Node 20+ via `--env-file` | Load `.env.local` in the seed script | No extra dependency needed if using `node --env-file` or tsx with dotenv |

### Not Needed

| Package | Why Not |
|---------|---------|
| `@supabase/ssr` | SSR client is for Next.js request/response context; script uses plain `createClient` |
| Custom migration libraries | No MongoDB data to migrate |
| `ts-node` | `tsx` is the modern, faster alternative; already usable via `npx tsx` |
| Playwright plugins/helpers | The base `@playwright/test` package covers everything needed for smoke tests |

### Environment Variables Required

Add to `.env.local` (these do not exist yet):

```
SEED_ADMIN_EMAIL=admin@ferment.com
SEED_ADMIN_PASSWORD=<strong-password>
SEED_ARTIST_PASSWORD=<shared-test-password>
```

The seed script also reads (already in `.env`):
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Installation:**
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

---

## Architecture Patterns

### Recommended Project Structure

```
scripts/
└── seed.ts              # New seed script (replaces src/seed.ts for Supabase)

tests/
└── smoke/
    ├── auth.spec.ts         # sign-in, sign-up, /pending, /auth/confirm
    └── storefront.spec.ts   # subdomain routing, product listing, category filter

playwright.config.ts         # Root-level Playwright configuration
```

The old `src/seed.ts` (Payload-based) stays untouched until Phase 7 cleanup. The new seed lives at `scripts/seed.ts`.

### Pattern 1: Seed Script Structure

```typescript
// scripts/seed.ts
// Run with: npx tsx --env-file=.env.local scripts/seed.ts
// (tsx loads .env.local automatically if you pass --env-file)
// OR: use dotenv/config at the top

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types.js'

// Create service-role client inline — do NOT import src/lib/supabase/admin.ts
// because that file imports 'server-only' which throws outside Next.js context.
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function seed() {
  // Insert order: auth.users → public.users → tenants → user_tenants → categories → products
  await seedAdmin()
  await seedArtists()
  await seedCategories()
  await seedProducts()
}

seed()
  .then(() => { console.log('Seed complete'); process.exit(0) })
  .catch((err) => { console.error('Seed failed:', err); process.exit(1) })
```

### Pattern 2: Creating Supabase Auth Users (Admin API)

Use `supabase.auth.admin.createUser()` — this is the service-role endpoint that creates users server-side.

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
const { data, error } = await supabase.auth.admin.createUser({
  email: 'admin@ferment.com',
  password: process.env.SEED_ADMIN_PASSWORD,
  email_confirm: true,           // CRITICAL: auto-confirms email so user can log in immediately
  user_metadata: {},             // optional; JWT hook reads from public.users table, not metadata
})
// data.user.id is the UUID to use in public.users insert
```

**Critical parameter:** `email_confirm: true` auto-confirms the email address. Without it, the user exists in `auth.users` but cannot sign in until email is confirmed. All seed users must have `email_confirm: true`.

**`app_role` assignment:** The JWT hook reads `app_role` from `public.users.role`, NOT from `user_metadata`. Set `users.role = 'super-admin'` in the public.users row — the hook will embed it into every JWT automatically. No `user_metadata` manipulation is needed.

### Pattern 3: Idempotent Insert (Check-Then-Insert)

Use select-then-skip for all entities. Do NOT use upsert for auth users (the admin API has no upsert — re-creating an existing email throws an error). For database rows, slug is the stable idempotency key.

```typescript
// Pattern for auth users:
async function getOrCreateAuthUser(email: string, password: string): Promise<string> {
  // Check if user already exists by listing users and filtering by email
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)
  if (existing) {
    console.log(`SKIP auth user: ${email}`)
    return existing.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log(`CREATE auth user: ${email}`)
  return data.user.id
}

// Pattern for database rows (categories, tenants, products):
async function getOrCreateCategory(slug: string, data: CategoryInsert): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single()
  if (existing) {
    console.log(`SKIP category: ${slug}`)
    return existing.id
  }
  const { data: created, error } = await supabase
    .from('categories')
    .insert(data)
    .select('id')
    .single()
  if (error) throw error
  console.log(`CREATE category: ${slug}`)
  return created.id
}
```

### Pattern 4: FK Insert Order

Insert in this exact order to satisfy all FK constraints:

1. Auth users via `supabase.auth.admin.createUser()` — produces UUIDs for step 2
2. `public.users` rows — `id` must match `auth.users.id` (FK: `references auth.users(id)`)
3. `tenants` rows — requires nothing upstream
4. `user_tenants` rows — requires both `users.id` and `tenants.id`
5. `categories` — parent categories first, then subcategories (self-referential FK via `parent_id`)
6. `products` — requires `tenant_id` (tenants) and `category_id` (categories)

### Pattern 5: Playwright Configuration

```typescript
// playwright.config.ts (root level)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    // Run headed in CI; headless locally for speed
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,   // don't kill an already-running dev server
    timeout: 120_000,
  },
})
```

### Pattern 6: Playwright Subdomain Testing on Localhost

Playwright's `page.goto()` with a full URL overrides `baseURL`. Subdomain navigation on localhost works in Chromium without OS-level DNS changes.

```typescript
// tests/smoke/storefront.spec.ts
import { test, expect } from '@playwright/test'

test('artist1 storefront renders via subdomain', async ({ page }) => {
  // Navigate directly to subdomain URL — Chromium resolves artist1.localhost
  await page.goto('http://ceramics-by-ana.localhost:3000')
  // Middleware rewrites to /tenants/ceramics-by-ana — verify storefront content
  await expect(page.getByRole('heading', { name: /ceramics by ana/i })).toBeVisible()
})
```

**Note:** `*.localhost` subdomains resolve to 127.0.0.1 in modern browsers (Chrome 76+) without any `/etc/hosts` change. This works in Playwright/Chromium. Firefox does not resolve `*.localhost` subdomains by default — stick with Chromium.

### Pattern 7: Playwright Auth Test

```typescript
// tests/smoke/auth.spec.ts
import { test, expect } from '@playwright/test'

test('sign-in page renders and accepts credentials', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page.getByLabel(/email/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
  await page.getByLabel(/email/i).fill(process.env.SEED_ADMIN_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.SEED_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  // After successful login, should not stay on /sign-in
  await expect(page).not.toHaveURL('/sign-in')
})

test('sign-up page renders with shopName field', async ({ page }) => {
  await page.goto('/sign-up')
  await expect(page.getByLabel(/shop name/i)).toBeVisible()
})

test('/pending page renders without 404', async ({ page }) => {
  const response = await page.goto('/pending')
  expect(response?.status()).not.toBe(404)
})

test('/auth/confirm responds without 404', async ({ page }) => {
  // Hit with no token — will likely redirect or show error, but must not 404
  const response = await page.goto('/auth/confirm')
  expect(response?.status()).not.toBe(404)
})
```

### Pattern 8: Reading .env.local in Scripts

`tsx` does not load `.env.local` automatically. Use one of these approaches (in order of preference):

**Option A — node --env-file flag (Node 20+, no extra deps):**
```bash
npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts
```

**Option B — dotenv at top of script:**
```typescript
import 'dotenv/config'  // reads .env
// .env.local is NOT loaded by dotenv automatically; must load manually:
import { configDotenv } from 'dotenv'
configDotenv({ path: '.env.local', override: true })
```

Use Option A — it requires no extra dependency and works cleanly with `tsx`.

### Anti-Patterns to Avoid

- **Importing `src/lib/supabase/admin.ts`** — it imports `server-only`, which throws `Error: This module cannot be imported from a Client Component` when run outside Next.js. Create an inline client in the script.
- **Using `supabase.auth.admin.upsertUser()`** — this method does not exist. Use list-then-create for idempotency.
- **Inserting `public.users` before `auth.users`** — the FK `references auth.users(id)` will fail. Always create the auth user first.
- **Setting `tenants.stripe_account_id` to `null`** — the column is `NOT NULL`. Use `''` (empty string) as placeholder for test tenants without real Stripe accounts.
- **Setting `tenants.status` to `'active'`** — the check constraint allows only `('pending', 'approved', 'rejected', 'suspended')`. Test artist tenants must use `status: 'approved'` so their products are visible to the public via RLS.
- **Using Firefox for subdomain tests** — Firefox does not resolve `*.localhost` subdomains. Use Chromium only.
- **Hardcoding credentials in `scripts/seed.ts`** — all passwords and emails must come from `process.env`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth user creation | Custom `INSERT INTO auth.users` SQL | `supabase.auth.admin.createUser()` | Direct SQL to `auth.users` bypasses auth triggers, hashing, metadata; admin API handles all of this correctly |
| Email confirmation | Manual token generation + verification | `email_confirm: true` in `createUser()` | One parameter; handles the entire confirmation flow server-side |
| RLS bypass for bulk inserts | Custom SQL or disabling RLS | Service-role client (`createClient` with `SUPABASE_SERVICE_ROLE_KEY`) | Service-role key bypasses RLS automatically on all operations; no SQL manipulation needed |
| Listing existing auth users | Querying `auth.users` table directly | `supabase.auth.admin.listUsers()` | Admin API is the correct interface; direct table access works but bypasses intended access patterns |
| Browser automation | Manual test scripts with `fetch` | `@playwright/test` | Playwright handles browser lifecycle, waiting, assertions, and screenshots automatically |

**Key insight:** The Supabase service-role client is the complete answer to seeding. It bypasses RLS, has admin auth operations, and uses the same SDK the app already imports. No separate tooling or SQL scripting is needed.

---

## Common Pitfalls

### Pitfall 1: `status = 'active'` Does Not Exist

**What goes wrong:** Inserting a tenant with `status: 'active'` throws a PostgreSQL check constraint violation. The RLS public-read policy checks `status = 'approved'`, not `'active'`.
**Why it happens:** The CONTEXT.md says "status = active" colloquially, but the actual check constraint (Phase 1 schema) uses `('pending', 'approved', 'rejected', 'suspended')`.
**How to avoid:** Use `status: 'approved'` for all test artist tenants in the seed script.
**Warning signs:** `violates check constraint "tenants_status_check"` error during seed.

### Pitfall 2: `server-only` Import in Script Context

**What goes wrong:** Importing `src/lib/supabase/admin.ts` from the seed script throws: `Error: This module cannot be imported from a Client Component module. It can only be used from a Server Component.`
**Why it happens:** `admin.ts` has `import 'server-only'` at the top — a Next.js-specific guard that throws when the module is loaded outside Next.js.
**How to avoid:** Create the service-role client inline in `scripts/seed.ts` using `createClient` imported directly from `@supabase/supabase-js`.
**Warning signs:** The error appears immediately on script startup before any Supabase calls run.

### Pitfall 3: `public.users` Insert Without Matching Auth User

**What goes wrong:** Inserting a row into `public.users` with an `id` that does not exist in `auth.users` fails with a FK violation.
**Why it happens:** `public.users.id` has `references auth.users(id)` — the auth user must exist first.
**How to avoid:** Always call `supabase.auth.admin.createUser()` first, capture `data.user.id`, then use that UUID for the `public.users` insert.
**Warning signs:** `insert or update on table "users" violates foreign key constraint "users_id_fkey"`.

### Pitfall 4: Re-running Seed Creates Duplicate Auth Users

**What goes wrong:** `createUser()` throws `User already registered` error on second run.
**Why it happens:** The admin API does not have upsert semantics — creating a user with an existing email is an error.
**How to avoid:** Use `listUsers()` to check for the email before calling `createUser()`. If the user exists, extract the ID and skip creation.
**Warning signs:** `AuthApiError: User already registered` on second seed run.

### Pitfall 5: `tenants.stripe_account_id` Cannot Be Null or Empty in Some Contexts

**What goes wrong:** `''` as `stripe_account_id` is accepted by Postgres (NOT NULL, no format check), but may cause issues in Phase 4 when Stripe-related code tries to use it.
**Why it happens:** The column is `text not null unique` — empty string satisfies NOT NULL but creates a uniqueness conflict if you try to seed more than one tenant with `''`.
**How to avoid:** Use a placeholder that is unique per tenant: e.g. `placeholder_ceramics-by-ana`. This satisfies the `unique` constraint while being obviously fake. Phase 4 will replace these during Stripe onboarding.
**Warning signs:** `duplicate key value violates unique constraint "tenants_stripe_account_id_key"` when seeding multiple tenants.

### Pitfall 6: Subcategory Insert Before Parent Category

**What goes wrong:** Inserting a subcategory row with `parent_id` before the parent category row exists fails with FK violation.
**Why it happens:** `categories.parent_id references categories(id)` — the parent must exist.
**How to avoid:** In the seed loop, insert all parent categories (those with `parent_id: null`) first and collect their IDs, then insert subcategories using the collected parent IDs.
**Warning signs:** `insert or update on table "categories" violates foreign key constraint "categories_parent_id_fkey"`.

### Pitfall 7: Playwright Tests That Depend on Execution Order

**What goes wrong:** A test for the storefront fails because the sign-in test left the browser in an authenticated state (or unauthenticated state) that breaks subsequent tests.
**Why it happens:** Playwright shares browser context within a `describe` block unless explicitly isolated.
**How to avoid:** Give each test file its own `use: { storageState: undefined }` or use `test.use({ storageState: '' })` to start fresh. Keep auth tests and storefront tests in separate spec files so they run in separate contexts.

### Pitfall 8: `*.localhost` Does Not Resolve in Firefox

**What goes wrong:** Playwright subdomain test hangs or returns ERR_NAME_NOT_RESOLVED when running with Firefox.
**Why it happens:** Firefox requires explicit `/etc/hosts` entries for `*.localhost` subdomains.
**How to avoid:** Playwright config must target Chromium only for subdomain tests. The project config already specifies Chromium as the only browser.

---

## Code Examples

Verified patterns from codebase inspection and official Supabase docs:

### Complete Seed Script Skeleton

```typescript
// scripts/seed.ts — run with: npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types.js'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── CATEGORIES (from src/seed.ts — these slugs are hardcoded in categories router) ───
const CATEGORIES = [
  { name: 'all', slug: 'all', color: null },
  { name: 'clothes', slug: 'clothes', color: '#FF6B9D', subcategories: [
    { name: 't-shirts', slug: 't-shirts' },
    { name: 'hoodies & sweatshirts', slug: 'hoodies-sweatshirts' },
    { name: 'prints & graphics', slug: 'prints-graphics' },
    { name: 'dresses & skirts', slug: 'dresses-skirts' },
    { name: 'pants & shorts', slug: 'pants-shorts' },
  ]},
  { name: 'jewelery', slug: 'jewelery', color: '#FFD700', subcategories: [
    { name: 'rings', slug: 'rings' },
    { name: 'necklaces & pendants', slug: 'necklaces-pendants' },
    { name: 'earrings', slug: 'earrings' },
    { name: 'bracelets & anklets', slug: 'bracelets-anklets' },
    { name: 'body jewelry', slug: 'body-jewelry' },
  ]},
  { name: 'posters', slug: 'posters', color: '#7EC8E3', subcategories: [
    { name: 'art prints', slug: 'art-prints' },
    { name: 'photography prints', slug: 'photography-prints' },
    { name: 'vintage & retro', slug: 'vintage-retro' },
    { name: 'music & band posters', slug: 'music-band-posters' },
    { name: 'movie & tv posters', slug: 'movie-tv-posters' },
  ]},
  { name: 'pottery', slug: 'pottery', color: '#D4A574', subcategories: [
    { name: 'bowls & dishes', slug: 'bowls-dishes' },
    { name: 'mugs & cups', slug: 'mugs-cups' },
    { name: 'vases & planters', slug: 'vases-planters' },
    { name: 'plates & platters', slug: 'plates-platters' },
    { name: 'decorative pieces', slug: 'decorative-pieces' },
  ]},
  { name: 'accessories', slug: 'accessories', color: '#96E6B3', subcategories: [
    { name: 'bags & totes', slug: 'bags-totes' },
    { name: 'hats & headwear', slug: 'hats-headwear' },
    { name: 'pins & patches', slug: 'pins-patches' },
    { name: 'belts & straps', slug: 'belts-straps' },
    { name: 'scarves & bandanas', slug: 'scarves-bandanas' },
  ]},
  { name: 'tattoos', slug: 'tattoos', color: '#FF69B4', subcategories: [
    { name: 'flash art', slug: 'flash-art' },
    { name: 'custom designs', slug: 'custom-designs' },
    { name: 'temporary tattoos', slug: 'temporary-tattoos' },
  ]},
  { name: 'music', slug: 'music', color: '#B5B9FF', subcategories: [
    { name: 'albums & eps', slug: 'albums-eps' },
    { name: 'singles & tracks', slug: 'singles-tracks' },
    { name: 'vinyl records', slug: 'vinyl-records' },
    { name: 'digital downloads', slug: 'digital-downloads' },
    { name: 'music merch', slug: 'music-merch' },
  ]},
]

// ─── TEST TENANTS ──────────────────────────────────────────────────────────────
const ARTISTS = [
  {
    email: 'artist1@test.ferment.com',
    username: 'ceramics-by-ana',
    tenant: { name: 'Ceramics by Ana', slug: 'ceramics-by-ana', stripeId: 'placeholder_ceramics-by-ana' },
  },
  {
    email: 'artist2@test.ferment.com',
    username: 'woodworks-jan',
    tenant: { name: 'Woodworks Jan', slug: 'woodworks-jan', stripeId: 'placeholder_woodworks-jan' },
  },
  {
    email: 'artist3@test.ferment.com',
    username: 'print-studio-mia',
    tenant: { name: 'Print Studio Mia', slug: 'print-studio-mia', stripeId: 'placeholder_print-studio-mia' },
  },
]

// Helper: get or create auth user
async function getOrCreateAuthUser(email: string, password: string, confirmEmail = true) {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)
  if (existing) { console.log(`SKIP auth: ${email}`); return existing.id }
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: confirmEmail })
  if (error) throw error
  console.log(`CREATE auth: ${email}`)
  return data.user.id
}

// Helper: get or create by slug
async function getOrCreateBySlug<T extends { id: string }>(
  table: 'categories' | 'tenants',
  slug: string,
  insertData: Record<string, unknown>
): Promise<string> {
  const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle()
  if (existing) { console.log(`SKIP ${table}: ${slug}`); return existing.id }
  const { data, error } = await supabase.from(table).insert(insertData).select('id').single()
  if (error) throw error
  console.log(`CREATE ${table}: ${slug}`)
  return (data as { id: string }).id
}
```

### Confirmed Schema Facts (from src/lib/supabase/types.ts)

```
users table:
  id: string          — NOT NULL, must match auth.users.id exactly
  username: string    — NOT NULL
  role: string        — default 'user'; use 'super-admin' for admin
  created_at, updated_at: auto-set

tenants table:
  name: string        — NOT NULL
  slug: string        — NOT NULL, must be unique
  status: string      — default 'pending'; use 'approved' for visible test tenants
  stripe_account_id: string — NOT NULL, no default; use 'placeholder_{slug}'
  stripe_details_submitted: boolean — default false
  image_id: null (optional)

user_tenants table:
  user_id: string     — FK to users.id
  tenant_id: string   — FK to tenants.id
  (no role column — role is on public.users.role)

categories table:
  name: string        — NOT NULL
  slug: string        — NOT NULL, unique
  color: string|null  — optional
  parent_id: string|null — FK to categories.id; null for top-level

products table:
  name: string        — NOT NULL
  price: number       — NOT NULL (stored as numeric in DB, number in JS)
  tenant_id: string   — NOT NULL, FK to tenants.id
  category_id: string|null — optional, FK to categories.id
  refund_policy: string — default '30-day'; valid: '30-day','14-day','7-day','3-day','1-day','no-refunds'
  is_archived: boolean — default false
  is_private: boolean  — default false
  description, content, image_id, cover_id — all optional
```

### Playwright webServer Config (Confirmed Pattern)

```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,  // reuse in local dev, always start fresh in CI
  timeout: 120_000,
}
```

### Category Slugs Hardcoded in Categories Router

These exact slugs appear in `src/modules/categories/server/procedures.ts` `customOrder` array and must be present in the seed data:

```typescript
const customOrder = ['all', 'clothes', 'jewelery', 'posters', 'pottery', 'tattoos', 'music', 'accessories']
```

All 8 must exist as top-level categories with exactly these slugs. The seed script must reproduce them verbatim.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bun run src/seed.ts` (Payload) | `npx tsx scripts/seed.ts` (Supabase) | Phase 3 | Script location changes; old seed stays until Phase 7 |
| `ts-node` for TypeScript scripts | `tsx` | 2023-2024 | tsx is faster, zero-config, handles ESM correctly |
| `@playwright/test` vs Cypress | Playwright is standard for Next.js 15 | 2024 | Playwright has official Next.js integration via `webServer` config |

**Deprecated/outdated:**
- `src/seed.ts`: The existing Payload-based seed is obsolete for Phase 3 but must NOT be deleted until Phase 7.
- `scripts/migrate-categories.js`: MongoDB migration script — completely irrelevant now; do not reference it.

---

## Open Questions

1. **`listUsers()` pagination limit**
   - What we know: `supabase.auth.admin.listUsers()` returns up to 1000 users by default
   - What's unclear: If the project eventually has >1000 auth users, the idempotency check would miss them
   - Recommendation: Acceptable for Phase 3 (project is empty). Add `{ page: 1, perPage: 1000 }` for clarity. For production-scale seeding, use `getUserByEmail` instead (but that API may require a different approach).

2. **Playwright test environment variables**
   - What we know: Playwright does not automatically load `.env.local`
   - What's unclear: Whether `dotenv` needs to be explicitly loaded in `playwright.config.ts` for test credentials
   - Recommendation: Add `require('dotenv').config({ path: '.env.local' })` at the top of `playwright.config.ts`, or use `env` key in Playwright config to pass specific variables.

3. **`supabase.auth.admin.listUsers()` vs `getUserByEmail()`**
   - What we know: `listUsers()` returns paginated results; `getUserByEmail` is available via the admin API
   - What's unclear: Whether `getUserByEmail` is in `@supabase/supabase-js` v2.98.0 or only in newer versions
   - Recommendation: Use `listUsers()` with email filter approach for Phase 3. If the list grows large, switch to `supabase.auth.admin.getUserByEmail(email)` in future.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/supabase/types.ts` — exact schema: all table names, column names, nullable constraints, FK relationships
- `src/seed.ts` (old Payload seed) — authoritative category taxonomy including all 8 parent slugs and subcategory slugs
- `src/modules/categories/server/procedures.ts` — hardcoded `customOrder` array with exactly the slugs the seed must produce
- `src/lib/supabase/admin.ts` — existing service-role client pattern (import path confirmed; `server-only` pitfall identified)
- `.planning/phases/01-foundation/01-RESEARCH.md` — JWT hook source SQL; `users.role` check constraint confirmed: `('user', 'super-admin')`
- `.planning/STATE.md` accumulated decisions — `stripe_account_id` empty string placeholder; `user_tenants` has no role column; `tenants.status` enum values

### Secondary (MEDIUM confidence)
- Supabase JS reference for `auth.admin.createUser()`: `email_confirm: true` parameter behavior confirmed against package version `^2.98.0` already in use
- Playwright official docs for `webServer` config: pattern matches `@playwright/test` v1.x standard

### Tertiary (LOW confidence)
- `*.localhost` subdomain resolution in Chromium: based on known browser behavior (Chrome 76+ resolves `*.localhost`); not directly tested against this specific setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages already in repo or are de-facto standards with zero ambiguity
- Architecture: HIGH — based directly on codebase inspection of existing types, middleware, and categories router
- Category taxonomy: HIGH — extracted verbatim from `src/seed.ts` and confirmed against `customOrder` in the categories procedure
- Schema constraints: HIGH — read directly from generated `types.ts` (Row/Insert types are ground truth)
- Playwright subdomain: MEDIUM — based on known Chromium behavior; functional testing against dev server is the validation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable libraries; Supabase JS API does not change frequently)

# Phase 5: Storage Migration - Research

**Researched:** 2026-03-10
**Domain:** Supabase Storage, Next.js Image configuration, tRPC mutation patterns, seed script extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migration Reality**
- No real images exist in Vercel Blob — there is nothing to download or re-upload
- Phase must include a SQL verification query that confirms zero `blob.vercel-storage.com` URLs across all text/URL columns in the database (satisfies STOR-02 and STOR-03 as a no-op migration)
- Seed script (`scripts/seed.ts`) must be updated to upload real test images to Supabase Storage and link them to products via `image_id`, so the storefront can be tested with actual images loading
- Test images sourced from `picsum.photos` (small public placeholder images) — seed downloads and uploads them via the Supabase JS SDK using the service-role key

**Bucket Structure**
- Single bucket named `media`, public-read access
- Path structure: `{tenant_id}/products/{uuid}.{ext}` for product images, `{tenant_id}/tenants/{uuid}.{ext}` for tenant logos
- Filenames are UUID v4 + original file extension (e.g. `f3a91c20-4e2b-4b7d-b3e1-abc123.jpg`) — collision-proof, no sensitive info in URL
- Replace-in-place for updates: new upload overwrites the existing file at the same path, keeping the same media row and URL
- Storage RLS policy: artists can write only to their own `{tenant_id}/` prefix (enforced via `auth.jwt()->>'tenant_id'` matching the folder name); anyone can read

**Upload Procedure**
- New `mediaRouter` at `src/modules/media/server/procedures.ts` — a dedicated router, not part of productsRouter
- Upload flow: browser calls Supabase Storage JS SDK directly (`supabase.storage.from('media').upload(...)`) — file never passes through the Next.js server
- After the browser upload completes, it calls a tRPC `media.createRow` mutation to insert a `media` table row with `storage_path` and `url` — this is what Phase 5 builds
- Accepted file types: JPEG, PNG, WebP only (MIME type validation client-side; storage path includes extension for clarity)
- Maximum file size: 5 MB, enforced client-side before upload starts

**Next.js Image Config**
- `next.config.ts` `remotePatterns` uses exact hostname only: `{project-ref}.supabase.co` (not a wildcard)
- All product/tenant images use Next.js `<Image>` component (not plain `<img>`) — automatic WebP conversion, responsive sizing, lazy loading
- No Supabase Storage image transforms (Imgproxy) — these require the Pro plan; Next.js built-in optimizer is sufficient
- The `NEXT_PUBLIC_SUPABASE_URL` env var already contains the project URL — planner should derive the hostname from it rather than hardcoding

### Claude's Discretion
- Exact SQL for the blob URL verification query
- picsum.photos URL selection for seed test images
- How many products get test images in the seed (2–3 per artist is sufficient)
- Storage bucket CORS configuration details
- The `media` table `alt_text` field value for seed images

### Deferred Ideas (OUT OF SCOPE)
- Artist-facing image upload UI (file picker, drag-and-drop, preview) — Phase 6 Custom Admin UI
- Storage cleanup / orphaned file deletion script — maintenance task, not in scope for migration
- Supabase Storage image transforms (Imgproxy resize/crop via URL params) — requires Pro plan, deferred indefinitely
- Multiple images per product — current schema is one `image_id` per product; multi-image gallery is a v2 feature
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOR-01 | Supabase Storage bucket created with public-read access policy for product images | Bucket SQL migration + RLS policy research; bucket must be named `media` with public read |
| STOR-02 | All files re-uploaded from Vercel Blob to Supabase Storage | No-op migration (no real Blob files exist); SQL verification query confirms zero `blob.vercel-storage.com` URLs |
| STOR-03 | All media URLs in the database updated to Supabase Storage URLs | Seed sets Supabase Storage URLs from the start; SQL verification query provides proof |
| STOR-04 | `next.config.ts` updated to allow Supabase Storage image domain | `remotePatterns` with exact Supabase hostname derived from `NEXT_PUBLIC_SUPABASE_URL` |
| STOR-05 | New file uploads use Supabase Storage (upload procedure updated) | `mediaRouter.createRow` tRPC mutation + client-side JS SDK upload pattern documented |
</phase_requirements>

---

## Summary

Phase 5 is primarily an infrastructure-plus-plumbing phase. There are no real images in Vercel Blob to migrate — the "migration" is demonstrating (via SQL verification) that no `blob.vercel-storage.com` URLs are present in the database. The substantive work is: creating the Supabase Storage `media` bucket with correct RLS policies, wiring up a `mediaRouter.createRow` tRPC mutation so the upload machinery exists for Phase 6, adding `remotePatterns` to `next.config.ts`, and extending `scripts/seed.ts` to download placeholder images from `picsum.photos` and upload them into Storage so the storefront renders real images.

The project already has generated TypeScript types for the `media` table (`src/lib/supabase/types.ts`), a service-role client for the seed script, and a consistent tRPC router pattern. All new code follows patterns established in Phases 2–4. The `media` table schema (confirmed from types) has columns: `id`, `alt`, `url`, `storage_path`, `mime_type`, `width`, `height`, `created_at` — note the column is `alt` not `alt_text`.

The one genuine technical question — whether `NEXT_PUBLIC_SUPABASE_URL` is safe to parse for the hostname at build time — is answered: Next.js `remotePatterns` accepts a `hostname` string. The URL must be parsed to extract just the hostname (`{project-ref}.supabase.co`) which can be done via `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname` inside `next.config.ts`.

**Primary recommendation:** Build in three sequential tasks: (1) bucket + RLS SQL migration, (2) `next.config.ts` remotePatterns + `mediaRouter`, (3) seed extension with picsum image uploads.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | Already installed | Storage upload, admin client in seed | Already in project; `.storage.from().upload()` is the standard client-side upload API |
| `next` | Already installed | Image optimization via `<Image>` + `remotePatterns` config | Already in project; `remotePatterns` in `next.config.ts` is the required mechanism |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | Already installed | Input validation for `mediaRouter.createRow` mutation | Consistent with all other routers in project |
| `tsx` | Already installed | Running `scripts/seed.ts` via `npx tsx` | Existing seed run mechanism |
| Node built-in `fetch` | Node 18+ built-in | Download picsum.photos images in seed script | Avoids adding `node-fetch` or `axios` dependency |
| Node built-in `crypto` | Built-in | Generate UUID v4 for storage path filenames | `crypto.randomUUID()` is available in Node 18+ |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side direct upload to Storage | Server-side upload via tRPC | Client-side avoids the Next.js server becoming a file proxy; keeps 5MB files off the server memory; matches Supabase documentation pattern |
| Hardcoded Supabase hostname in `remotePatterns` | Dynamic derivation from `NEXT_PUBLIC_SUPABASE_URL` | Dynamic is correct — CONTEXT.md mandates this approach; hardcoding creates drift risk |

**Installation:** No new packages required. Everything needed is already in the project.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── modules/
│   └── media/
│       └── server/
│           └── procedures.ts   # new — mediaRouter with createRow mutation
└── trpc/
    └── routers/
        └── _app.ts             # add media: mediaRouter import

scripts/
└── seed.ts                     # extend — add seedImages() function

supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_storage_bucket_rls.sql   # new — bucket + RLS
```

### Pattern 1: Supabase Storage Bucket Creation via SQL Migration

**What:** Create the `media` bucket and storage RLS policies in a SQL migration file that is applied via `supabase db push` or the Supabase dashboard SQL editor.

**When to use:** Any time a new bucket or storage policy is needed — infrastructure-as-code, idempotent.

**Example:**
```sql
-- Create the media bucket (public-read)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Allow public (anonymous) reads on all objects in the media bucket
create policy "Public read access for media bucket"
  on storage.objects
  for select
  using (bucket_id = 'media');

-- Allow authenticated artists to upload to their own tenant prefix
create policy "Artists can upload to own tenant folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

-- Allow authenticated artists to update (replace) their own files
create policy "Artists can update own tenant files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );
```

**Confidence:** HIGH — `storage.foldername()` is a Supabase Storage built-in helper. `auth.jwt() ->> 'tenant_id'` matches the existing JWT custom claims hook from Phase 1 (`FOUN-05`).

### Pattern 2: mediaRouter.createRow Mutation

**What:** A `protectedProcedure` tRPC mutation that inserts a row into the `media` table after a client-side upload completes. Takes `{ storage_path, url, alt, mime_type?, width?, height? }`, returns the new row `id`.

**When to use:** Called by the browser immediately after `supabase.storage.from('media').upload()` succeeds.

**Example:**
```typescript
// src/modules/media/server/procedures.ts
import z from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const mediaRouter = createTRPCRouter({
  createRow: protectedProcedure
    .input(z.object({
      storage_path: z.string(),
      url: z.string().url(),
      alt: z.string(),
      mime_type: z.string().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('media')
        .insert({
          storage_path: input.storage_path,
          url: input.url,
          alt: input.alt,
          mime_type: input.mime_type ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return data
    }),
})
```

**Note:** Uses `ctx.supabase` (anon client, RLS-enforced) — the media table INSERT policy should allow authenticated users to insert their own media rows. This aligns with `protectedProcedure` requiring an authenticated user.

### Pattern 3: Seed Image Upload (getOrCreateMediaAndLink)

**What:** Idempotent seed helper that checks if a product already has an `image_id`, skips if so, otherwise downloads from picsum, uploads to Storage, inserts a `media` row, and sets `products.image_id`.

**When to use:** Inside `seedProducts()` after each product is created/confirmed.

**Example:**
```typescript
async function getOrCreateMediaForProduct(
  tenantId: string,
  productId: string,
  picsumId: number,
  altText: string
): Promise<void> {
  // Skip if already has image
  const { data: existing } = await supabase
    .from('products')
    .select('image_id')
    .eq('id', productId)
    .single()
  if (existing?.image_id) { console.log(`  SKIP image: ${altText}`); return }

  // Download from picsum (400x400, specific seed for reproducibility)
  const imageUrl = `https://picsum.photos/seed/${picsumId}/400/400`
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()

  // Upload to Supabase Storage
  const filename = `${crypto.randomUUID()}.jpg`
  const storagePath = `${tenantId}/products/${filename}`
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`)

  // Build public URL
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(storagePath)

  // Insert media row
  const { data: mediaRow, error: insertError } = await supabase
    .from('media')
    .insert({ storage_path: storagePath, url: publicUrl, alt: altText, mime_type: 'image/jpeg', width: 400, height: 400 })
    .select('id')
    .single()
  if (insertError) throw new Error(`Media insert: ${insertError.message}`)

  // Link product to media row
  const { error: updateError } = await supabase
    .from('products')
    .update({ image_id: mediaRow.id })
    .eq('id', productId)
  if (updateError) throw new Error(`Product update: ${updateError.message}`)

  console.log(`  CREATE image: ${altText} -> ${storagePath}`)
}
```

**Key point:** `picsum.photos/seed/{number}/{width}/{height}` returns a deterministic image for the same seed number — reproducible across CI runs.

### Pattern 4: next.config.ts remotePatterns

**What:** Parse the Supabase URL from the env var at config build time; add as a `remotePatterns` entry so `<Image>` works.

**When to use:** Any time Next.js `<Image>` needs to serve from an external domain.

**Example:**
```typescript
// next.config.ts
import type { NextConfig } from 'next'

const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

**Caution:** `NEXT_PUBLIC_SUPABASE_URL` must be available in the environment when `next build` runs. For local dev this is in `.env.local`; for CI/production it must be set as an environment variable. If the env var is absent at build time, `new URL(undefined)` throws — add a fallback or guard if needed.

### Pattern 5: SQL Verification Query (Blob URL Check)

**What:** A SQL query that searches all text columns in key tables for `blob.vercel-storage.com`. Returns zero rows when migration is complete.

**When to use:** Run once in verification task to satisfy STOR-02 and STOR-03.

**Example:**
```sql
SELECT 'products.description' AS col, id, description AS value
FROM products WHERE description ILIKE '%blob.vercel-storage.com%'
UNION ALL
SELECT 'media.url', id, url FROM media WHERE url ILIKE '%blob.vercel-storage.com%'
UNION ALL
SELECT 'media.storage_path', id, storage_path FROM media WHERE storage_path ILIKE '%blob.vercel-storage.com%'
UNION ALL
SELECT 'tenants.name', id, name FROM tenants WHERE name ILIKE '%blob.vercel-storage.com%';
-- Expected: 0 rows
```

### Anti-Patterns to Avoid

- **Wildcard hostname in remotePatterns:** `*.supabase.co` would allow any Supabase project's storage to be proxied through your Next.js app. Use the exact project hostname.
- **Passing the file through Next.js server:** A tRPC mutation that accepts the raw file bytes would make the server a proxy for potentially large files, hitting memory limits and request body size limits. The client-side direct upload pattern avoids this entirely.
- **Using `ctx.supabaseAdmin` in mediaRouter:** The `createRow` mutation should use `ctx.supabase` (the anon/user client with RLS) so that media rows are scoped to the authenticated user. `supabaseAdmin` bypasses RLS and is only appropriate in the seed script and Stripe webhook.
- **Not guarding `new URL(undefined)` in next.config.ts:** If `NEXT_PUBLIC_SUPABASE_URL` is missing, the build will throw an unhelpful error. Add a fallback empty string or a conditional guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Public URL for a Storage object | Manual string concatenation | `supabase.storage.from('media').getPublicUrl(path)` | The SDK handles bucket URL, version prefix (`/storage/v1/object/public/`), and encoding correctly |
| UUID v4 for filenames | Custom random hex generation | `crypto.randomUUID()` (Node 18+ built-in) | Built-in, no dependency, cryptographically random |
| File MIME type detection | Reading magic bytes | Accept only known extensions (JPEG/PNG/WebP) from client-supplied MIME; validate at upload boundary | MIME detection is complex; the constraint is already known (three types only) |
| Storage folder access checking | Custom SQL query | `(storage.foldername(name))[1]` in RLS policy | Supabase provides this helper specifically for path-based tenant isolation |

**Key insight:** Supabase Storage already handles public URL construction, CDN caching, and access control. The application only needs to store the path and the resulting public URL in the `media` table — do not reimplement URL building logic.

---

## Common Pitfalls

### Pitfall 1: `media` table column is `alt`, not `alt_text`

**What goes wrong:** Writing `alt_text: '...'` in the insert payload causes a PostgREST error ("column alt_text does not exist") that is confusing because the CONTEXT.md refers to the field as `alt_text` informally.

**Why it happens:** The generated types file (`src/lib/supabase/types.ts`) is authoritative — it shows `alt: string` (required, not nullable) in both `Row` and `Insert`. The CONTEXT.md was using the informal name.

**How to avoid:** Always reference `src/lib/supabase/types.ts` `Tables<"media">` for exact column names. The required insert fields are `alt`, `storage_path`, and `url`.

**Warning signs:** PostgREST error "column alt_text of relation media does not exist" in seed output.

### Pitfall 2: Bucket RLS not applied when using service-role client

**What goes wrong:** The seed script uses the service-role client, which bypasses RLS entirely. If bucket policies are only tested via the seed, they appear to work but are actually never exercised. Phase 6 client-side uploads use the anon/user client and will fail if RLS policies are wrong.

**Why it happens:** Service-role key bypasses all RLS policies — this is correct for seed scripts but means storage policies are untested.

**How to avoid:** The SQL verification task should verify the policies exist (via `pg_policies` or the dashboard), not just that the seed script ran. The Playwright smoke test for image loading (Phase 5) uses anonymous requests and will catch a broken public-read policy.

**Warning signs:** Images load in seed verification but 403 on the deployed storefront.

### Pitfall 3: `next.config.ts` env var not available at build time

**What goes wrong:** `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname` throws `TypeError: Invalid URL` if `NEXT_PUBLIC_SUPABASE_URL` is undefined when `next build` runs.

**Why it happens:** Next.js evaluates `next.config.ts` at build time. In CI or when building a Docker image, the env var must be set as a build argument.

**How to avoid:** Add a guard: `const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'` so the build does not crash if the env var is missing. The placeholder pattern is a harmless fallback.

**Warning signs:** `next build` fails with `TypeError: Invalid URL` or `Cannot read properties of undefined (reading 'hostname')`.

### Pitfall 4: picsum.photos JPEG vs WebP content type mismatch

**What goes wrong:** `picsum.photos` redirects to a CDN URL. The final response body is JPEG but the Content-Type header may differ. Uploading with wrong `contentType` causes browser MIME mismatch warnings or rejection by `<Image>`.

**Why it happens:** `fetch(imageUrl)` follows redirects automatically. The final response content type from Picsum is `image/jpeg`.

**How to avoid:** Hardcode `contentType: 'image/jpeg'` in the storage upload call for picsum downloads (as in the example above). Extension `.jpg` and MIME `image/jpeg` are consistent.

### Pitfall 5: Storage upload to bucket that doesn't exist yet

**What goes wrong:** Seed script runs before the `media` bucket exists — Supabase Storage returns `StorageError: Bucket not found`.

**Why it happens:** The SQL migration for the bucket must be applied before the seed script runs.

**How to avoid:** The planner must order tasks so the bucket migration task precedes the seed extension task. Add a bucket existence check to the seed's startup or document the prerequisite clearly.

**Warning signs:** `Storage upload: Bucket not found` in seed output.

### Pitfall 6: products.cover_id vs products.image_id

**What goes wrong:** The `products` table has both `image_id` and `cover_id` columns (both FK to `media`). Using the wrong one means images don't appear in the storefront.

**Why it happens:** The existing `productsRouter` queries `image:media!image_id(*)` — so `image_id` is the field driving the storefront card image. `cover_id` appears unused in current procedures.

**How to avoid:** The seed extension should update `products.image_id`. This is confirmed by the products procedures file which joins `image:media!image_id(*)`.

---

## Code Examples

### Derive Supabase hostname in next.config.ts (Source: official Next.js docs + project pattern)
```typescript
import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseHostname = new URL(supabaseUrl).hostname

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

### Register mediaRouter in _app.ts
```typescript
// src/trpc/routers/_app.ts — add:
import { mediaRouter } from '@/modules/media/server/procedures'

export const appRouter = createTRPCRouter({
  // ... existing routers ...
  media: mediaRouter,
})
```

### Supabase Storage public URL pattern
```
https://{project-ref}.supabase.co/storage/v1/object/public/media/{tenant_id}/products/{uuid}.jpg
```
The `getPublicUrl()` SDK method constructs this. The `pathname` pattern in `remotePatterns` must be `/storage/v1/object/public/**` to match.

### SQL to verify blob.vercel-storage.com absence
```sql
SELECT 'media.url' AS col, COUNT(*) AS matches
FROM media WHERE url ILIKE '%blob.vercel-storage.com%'
UNION ALL
SELECT 'products.description', COUNT(*) FROM products WHERE description ILIKE '%blob.vercel-storage.com%'
UNION ALL
SELECT 'tenants.name', COUNT(*) FROM tenants WHERE name ILIKE '%blob.vercel-storage.com%';
-- All counts must be 0
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel Blob for file storage | Supabase Storage | Phase 5 (this phase) | All uploads use Supabase; Vercel Blob dependency can be removed in Phase 7 |
| No image optimization config | `remotePatterns` in next.config.ts | Phase 5 | Next.js `<Image>` now works for product images with WebP conversion and lazy loading |
| Products have `image_id = null` | Products have real `image_id` | Phase 5 seed extension | Storefront product cards render actual images |

**Deprecated/outdated:**
- `BLOB_READ_WRITE_TOKEN` env var: Present in `.env.example` — no longer needed after Phase 5; removed in Phase 7 (CLEN-04).

---

## Open Questions

1. **Does the `media` table have RLS INSERT policy for authenticated users?**
   - What we know: The generated types show `media.Insert` requires `alt`, `storage_path`, `url`. The context says `mediaRouter.createRow` uses `protectedProcedure` (anon client with RLS).
   - What's unclear: Whether a `media` INSERT policy was created in Phase 1. If not, the mutation will fail with RLS violation for non-service-role callers.
   - Recommendation: The planner should include a task to verify (and create if missing) an INSERT policy: `allow authenticated users to insert into media`. A safe policy: `for insert to authenticated with check (true)` — media rows have no tenant scope at the row level (they're referenced by products/tenants, not owned by a user directly).

2. **Does the Supabase project have the `media` bucket already created?**
   - What we know: The SQL migration for Phase 1 foundation may or may not have created it.
   - What's unclear: Current bucket state in the live project.
   - Recommendation: The bucket creation SQL uses `ON CONFLICT (id) DO NOTHING` — idempotent. The planner should always include it regardless.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (already configured) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/smoke/storefront.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | Storage bucket `media` exists with public-read access | smoke | `npx playwright test tests/smoke/storage.spec.ts --project=chromium` | ❌ Wave 0 |
| STOR-02 | Zero `blob.vercel-storage.com` URLs in database | smoke (SQL) | `npx tsx --env-file=.env.local scripts/verify-blob-urls.ts` | ❌ Wave 0 |
| STOR-03 | Database media URLs are Supabase Storage URLs | smoke (SQL) | included in STOR-02 script | ❌ Wave 0 |
| STOR-04 | Next.js `<Image>` works for Supabase Storage URLs | smoke | `npx playwright test tests/smoke/storage.spec.ts --project=chromium` | ❌ Wave 0 |
| STOR-05 | `mediaRouter.createRow` mutation accepts correct input | unit (manual) | `npx tsx --env-file=.env.local scripts/seed.ts` (exercises the pattern via seed) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/smoke/storefront.spec.ts --project=chromium` (existing test, verifies nothing broke)
- **Per wave merge:** `npx playwright test --project=chromium`
- **Phase gate:** Full suite green + blob URL verification script exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/smoke/storage.spec.ts` — covers STOR-01 (bucket accessible), STOR-04 (image renders via `<Image>`)
- [ ] `scripts/verify-blob-urls.ts` — covers STOR-02 and STOR-03 (SQL verification, exits non-zero if any blob URLs found)

---

## Sources

### Primary (HIGH confidence)
- `src/lib/supabase/types.ts` — authoritative media table schema: columns `id`, `alt`, `url`, `storage_path`, `mime_type`, `width`, `height`, `created_at`
- `src/trpc/init.ts` — confirms `baseProcedure`, `protectedProcedure`, `createTRPCRouter` exports and context shape (`ctx.supabase`, `ctx.user`)
- `src/trpc/routers/_app.ts` — router registration pattern; confirms no `media` router exists yet
- `scripts/seed.ts` — idempotency patterns (`getOrCreate*`), service-role client usage, seed structure to extend
- `next.config.ts` — confirmed empty; no existing `remotePatterns`
- `.planning/phases/05-storage-migration/05-CONTEXT.md` — all locked decisions sourced from here
- Supabase Storage documentation patterns (storage.foldername, getPublicUrl) — verified against project usage

### Secondary (MEDIUM confidence)
- Supabase Storage RLS policy pattern using `(storage.foldername(name))[1]` — standard documented approach for tenant path isolation
- Next.js `remotePatterns` with exact hostname — documented in Next.js Image Optimization docs

### Tertiary (LOW confidence)
- picsum.photos deterministic seed URL format (`/seed/{id}/{w}/{h}`) — behavior verified empirically by the community; not covered by an official SLA

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already in project
- Architecture: HIGH — patterns derived directly from existing project code
- Pitfalls: HIGH — column names and context verified against actual type definitions
- Validation: MEDIUM — Wave 0 test files don't exist yet; commands are correct but untested

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable Supabase JS SDK API; `remotePatterns` is stable since Next.js 13.4)

# Phase 5: Storage Migration - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

All product images and media files are served from Supabase Storage — no Vercel Blob URLs remain anywhere in the database or application code. New file uploads from the artist dashboard save to Supabase Storage. This phase builds the storage infrastructure and upload machinery; the artist-facing upload UI is Phase 6 (Custom Admin UI).

</domain>

<decisions>
## Implementation Decisions

### Migration Reality
- No real images exist in Vercel Blob — there is nothing to download or re-upload
- Phase must include a SQL verification query that confirms zero `blob.vercel-storage.com` URLs across all text/URL columns in the database (satisfies STOR-02 and STOR-03 as a no-op migration)
- Seed script (`scripts/seed.ts`) must be updated to upload real test images to Supabase Storage and link them to products via `image_id`, so the storefront can be tested with actual images loading
- Test images sourced from `picsum.photos` (small public placeholder images) — seed downloads and uploads them via the Supabase JS SDK using the service-role key

### Bucket Structure
- Single bucket named `media`, public-read access
- Path structure: `{tenant_id}/products/{uuid}.{ext}` for product images, `{tenant_id}/tenants/{uuid}.{ext}` for tenant logos
- Filenames are UUID v4 + original file extension (e.g. `f3a91c20-4e2b-4b7d-b3e1-abc123.jpg`) — collision-proof, no sensitive info in URL
- Replace-in-place for updates: new upload overwrites the existing file at the same path, keeping the same media row and URL
- Storage RLS policy: artists can write only to their own `{tenant_id}/` prefix (enforced via `auth.jwt()->>'tenant_id'` matching the folder name); anyone can read

### Upload Procedure
- New `mediaRouter` at `src/modules/media/server/procedures.ts` — a dedicated router, not part of productsRouter
- Upload flow: browser calls Supabase Storage JS SDK directly (`supabase.storage.from('media').upload(...)`) — file never passes through the Next.js server
- After the browser upload completes, it calls a tRPC `media.createRow` mutation to insert a `media` table row with `storage_path` and `url` — this is what the planner should build for Phase 5
- Accepted file types: JPEG, PNG, WebP only (MIME type validation client-side; storage path includes extension for clarity)
- Maximum file size: 5 MB, enforced client-side before upload starts

### Next.js Image Config
- `next.config.js` `remotePatterns` uses exact hostname only: `{project-ref}.supabase.co` (not a wildcard)
- All product/tenant images use Next.js `<Image>` component (not plain `<img>`) — automatic WebP conversion, responsive sizing, lazy loading
- No Supabase Storage image transforms (Imgproxy) — these require the Pro plan; Next.js built-in optimizer is sufficient
- The `NEXT_PUBLIC_SUPABASE_URL` env var already contains the project URL — planner should derive the hostname from it rather than hardcoding

### Claude's Discretion
- Exact SQL for the blob URL verification query
- picsum.photos URL selection for seed test images
- How many products get test images in the seed (2–3 per artist is sufficient)
- Storage bucket CORS configuration details
- The `media` table `alt_text` field value for seed images

</decisions>

<specifics>
## Specific Ideas

- The seed should upload small images (e.g. 400×400 from picsum.photos) — not full-resolution. Fast to download and upload in CI
- The `mediaRouter.createRow` mutation will be the primary integration point that Phase 6 calls after a client-side upload — design it to accept `{ storage_path, url, alt_text?, width?, height? }` and return the new `media` row id
- The planner should verify the `media` table schema (from Phase 1 generated types) to confirm exact column names before writing the insert

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/types.ts`: Generated Supabase types — includes `Tables<"media">` and `Tables<"tenants">`, already reflects the `media` table schema. Use to type the `createRow` mutation input/output.
- `src/lib/supabase/admin.ts` (service-role client): Already used in `scripts/seed.ts` — reuse pattern for seed image uploads
- `scripts/seed.ts`: All seed logic lives here. The image upload extension should follow the existing `getOrCreate*` idempotency pattern

### Established Patterns
- tRPC context provides `ctx.supabase` (anon client, RLS-enforced) and `ctx.supabaseAdmin` (service-role, RLS-bypassed)
- `baseProcedure` and `protectedProcedure` are defined in `src/trpc/init.ts` — `mediaRouter.createRow` should use `protectedProcedure` (artist must be authenticated to insert a media row)
- All routers follow the pattern: `createTRPCRouter({ ... })` in `src/modules/{feature}/server/procedures.ts` and registered in the root router

### Integration Points
- `src/modules/tenants/server/procedures.ts` already joins `media` via `image:media!image_id(*)` — the new media rows from Phase 5 seed will make this join return real data
- `src/modules/products/server/procedures.ts` also joins `media` via `image:media!image_id(*)` on product queries — updating seed products with `image_id` will exercise this join in Playwright tests
- `next.config.js` is currently empty (no `remotePatterns`) — Phase 5 adds the first image domain

</code_context>

<deferred>
## Deferred Ideas

- Artist-facing image upload UI (file picker, drag-and-drop, preview) — Phase 6 Custom Admin UI
- Storage cleanup / orphaned file deletion script — maintenance task, not in scope for migration
- Supabase Storage image transforms (Imgproxy resize/crop via URL params) — requires Pro plan, deferred indefinitely
- Multiple images per product — current schema is one `image_id` per product; multi-image gallery is a v2 feature

</deferred>

---

*Phase: 05-storage-migration*
*Context gathered: 2026-03-10*

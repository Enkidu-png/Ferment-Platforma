// scripts/verify-blob-urls.ts
// Run with: npx tsx --env-file=.env.local --env-file=.env scripts/verify-blob-urls.ts
// Exits 0 if no blob.vercel-storage.com URLs are found (migration complete).
// Exits 1 if any are found (migration incomplete).
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types.js'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BLOB_DOMAIN = 'blob.vercel-storage.com'

async function verifyNoBlobUrls(): Promise<void> {
  console.log('Checking for Vercel Blob URLs in database...')

  const checks = [
    {
      label: 'media.url',
      query: supabase.from('media').select('id, url').ilike('url', `%${BLOB_DOMAIN}%`),
    },
    {
      label: 'media.storage_path',
      query: supabase.from('media').select('id, storage_path').ilike('storage_path', `%${BLOB_DOMAIN}%`),
    },
    {
      label: 'products.description',
      query: supabase.from('products').select('id, description').ilike('description', `%${BLOB_DOMAIN}%`),
    },
    {
      label: 'tenants.name',
      query: supabase.from('tenants').select('id, name').ilike('name', `%${BLOB_DOMAIN}%`),
    },
  ]

  let totalMatches = 0

  for (const check of checks) {
    const { data, error } = await check.query
    if (error) {
      console.error(`  ERROR querying ${check.label}: ${error.message}`)
      process.exit(1)
    }
    const count = data?.length ?? 0
    if (count > 0) {
      console.error(`  FAIL ${check.label}: ${count} row(s) contain ${BLOB_DOMAIN}`)
      totalMatches += count
    } else {
      console.log(`  OK   ${check.label}: 0 matches`)
    }
  }

  if (totalMatches > 0) {
    console.error(`\nFAIL: ${totalMatches} Vercel Blob URL(s) found. Migration incomplete.`)
    process.exit(1)
  }

  console.log(`\nPASS: No ${BLOB_DOMAIN} URLs found. STOR-02 and STOR-03 satisfied.`)
  process.exit(0)
}

verifyNoBlobUrls().catch((err: unknown) => {
  console.error('Script failed:', err)
  process.exit(1)
})

// scripts/send-password-resets.ts
// Run: npx tsx --env-file=.env.local --env-file=.env scripts/send-password-resets.ts [--dry-run]
import { createClient } from '@supabase/supabase-js'

// Inline service-role client — do NOT import src/lib/supabase/admin.ts
// (admin.ts uses `server-only` which is incompatible with Node.js script context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const dryRun = process.argv.includes('--dry-run')

async function sendPasswordResets() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (error) throw error

  const artists = users.filter(u =>
    u.app_metadata?.app_role !== 'super-admin' && u.email
  )

  console.log(`Found ${artists.length} artists. Dry run: ${dryRun}`)

  for (const user of artists) {
    if (!user.email) continue
    if (dryRun) {
      console.log(`[DRY RUN] Would send reset to: ${user.email}`)
      continue
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email)
    if (resetError) {
      console.error(`FAIL ${user.email}: ${resetError.message}`)
    } else {
      console.log(`SENT ${user.email}`)
    }
    // Respect Supabase Free tier 4 emails/hour limit
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('Done.')
}

sendPasswordResets().catch(err => { console.error(err); process.exit(1) })

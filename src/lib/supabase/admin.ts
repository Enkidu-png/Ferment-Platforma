import { createClient } from '@supabase/supabase-js'
import 'server-only'
import type { Database } from './types'

// Singleton — module-level; do not call createClient() per-request
// Uses service role key: bypasses ALL RLS policies — only for trusted server operations
// (Stripe webhooks, admin actions, data migration scripts)
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import 'server-only'
import type { Database } from './types'

// Lazy singleton — createClient() is deferred until first use so the build
// can import this module without crashing when env vars are absent at build time.
// Uses service role key: bypasses ALL RLS policies — only for trusted server
// operations (Stripe webhooks, admin actions, data migration scripts).
let _client: SupabaseClient<Database> | null = null

function getClient(): SupabaseClient<Database> {
  if (!_client) {
    _client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return _client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop: string | symbol) {
    return getClient()[prop as keyof SupabaseClient<Database>]
  },
})

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  const cookieOptions = process.env.NODE_ENV === 'production'
    ? {
        domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
        path: '/',
        sameSite: 'lax' as const,
        secure: true,
      }
    : undefined;

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions }
  )
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  const cookieOptions = process.env.NODE_ENV === 'production'
    ? {
        domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
        path: '/',
        sameSite: 'lax' as const,
        secure: true,
      }
    : undefined;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component calling set() — ignored; middleware handles refresh
          }
        },
      },
    }
  )
}

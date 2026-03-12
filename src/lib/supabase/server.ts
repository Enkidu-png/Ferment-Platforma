import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  // Never set a cookie domain — let the browser default to the current host.
  // Setting domain: ".ferment.com" on vercel.app would cause the browser to
  // reject the cookie (domain mismatch), silently breaking the session.
  // When the app moves to the real custom domain, subdomain cookie sharing
  // can be added back here.
  const cookieOptions = undefined;

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

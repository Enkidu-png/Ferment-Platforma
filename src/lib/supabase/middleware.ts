import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const cookieOptions = process.env.NODE_ENV === 'production'
    ? {
        domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
        path: '/',
        sameSite: 'lax' as const,
        secure: true,
      }
    : undefined;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST use getUser() not getSession() — getUser() validates JWT server-side.
  // getSession() reads the cookie without contacting Supabase; a tampered cookie can spoof auth.
  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}

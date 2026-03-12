import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

function getCookieOptions() {
  if (process.env.NODE_ENV !== 'production') return undefined

  // Only set a cross-subdomain cookie domain when the app is actually
  // running on the configured root domain. When deployed to *.vercel.app
  // (e.g. ferment-platforma.vercel.app) the custom domain hasn't been
  // configured yet — setting a mismatched domain causes the browser to
  // reject the cookie and auth fails silently.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!rootDomain) return undefined

  // Check if we're actually on the configured domain at runtime.
  // window is undefined during SSR so guard for that too.
  const isConfiguredDomain =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith(rootDomain)

  if (!isConfiguredDomain) return undefined

  return {
    domain: `.${rootDomain}`,
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
  }
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: getCookieOptions() }
  )
}

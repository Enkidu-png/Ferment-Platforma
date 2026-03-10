import type { NextConfig } from 'next'

// Derive hostname from env var at build time.
// Fallback prevents build crash when NEXT_PUBLIC_SUPABASE_URL is not set (e.g. CI without env).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseHostname = new URL(supabaseUrl).hostname

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig

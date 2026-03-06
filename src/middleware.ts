import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    "/((?!api/|_next/|_static/|_vercel|media/|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req: NextRequest) {
  // Step 1: Supabase session refresh — returns the response we MUST use.
  // Never discard supabaseResponse — it carries the refreshed session cookies.
  const { supabaseResponse } = await updateSession(req);

  // Step 2: Apply subdomain routing by mutating supabaseResponse.
  // NEVER call NextResponse.rewrite() or NextResponse.next() after this point —
  // it would create a new response object and discard the refreshed cookies.
  const hostname = req.headers.get("host") || "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

  if (hostname.endsWith(`.${rootDomain}`)) {
    const tenantSlug = hostname.replace(`.${rootDomain}`, "");
    const rewriteUrl = new URL(
      `/tenants/${tenantSlug}${req.nextUrl.pathname}`,
      req.url
    );
    supabaseResponse.headers.set("x-middleware-rewrite", rewriteUrl.toString());
  }

  return supabaseResponse;
}

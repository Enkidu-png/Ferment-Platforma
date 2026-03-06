import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      const shopName = data.user.user_metadata?.shop_name as string | undefined;
      const baseSlug =
        shopName?.toLowerCase().replace(/\s+/g, "-") ?? data.user.id;

      const { data: existing } = await supabase
        .from("tenants")
        .select("slug")
        .eq("slug", baseSlug)
        .maybeSingle();

      const slug = existing
        ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        : baseSlug;

      // stripe_account_id is NOT NULL in the schema; use empty placeholder until
      // the Stripe onboarding flow runs and fills it in (Phase 4).
      const { data: tenant } = await supabase
        .from("tenants")
        .insert({
          name: shopName ?? "New Store",
          slug,
          status: "pending",
          stripe_account_id: "",
        })
        .select("id")
        .single();

      // Link tenant to the confirming user via the user_tenants join table
      // (tenants has no direct user_id column — the relationship is many-to-many).
      if (tenant) {
        await supabase
          .from("user_tenants")
          .insert({ tenant_id: tenant.id, user_id: data.user.id });
      }

      return NextResponse.redirect(`${origin}/pending`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirmation_failed`);
}

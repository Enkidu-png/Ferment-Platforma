import type { Stripe } from "stripe";
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExpandedLineItem } from "@/modules/checkout/types";

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await (await req.blob()).text(),
      req.headers.get("stripe-signature") as string,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (error! instanceof Error) console.log(error);
    console.log(`❌ Error message: ${errorMessage}`);
    return NextResponse.json(
      { message: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  console.log("✅ Success:", event.id);

  const permittedEvents: string[] = [
    "checkout.session.completed",
    "account.updated",
  ];

  if (permittedEvents.includes(event.type)) {
    let data;

    try {
      switch (event.type) {
        case "checkout.session.completed":
          data = event.data.object as Stripe.Checkout.Session;

          if (!data.metadata?.userId) {
            throw new Error("User ID is required");
          }

          // Validate user exists in Supabase (service-role bypasses RLS)
          const { data: dbUser } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("id", data.metadata.userId)
            .maybeSingle();

          if (!dbUser) {
            throw new Error("User not found");
          }

          const expandedSession = await stripe.checkout.sessions.retrieve(
            data.id,
            { expand: ["line_items.data.price.product"] },
            { stripeAccount: event.account },
          );

          if (
            !expandedSession.line_items?.data ||
            !expandedSession.line_items.data.length
          ) {
            throw new Error("No line items found");
          }

          const lineItems = expandedSession.line_items.data as ExpandedLineItem[];

          for (const item of lineItems) {
            await supabaseAdmin.from("orders").insert({
              stripe_checkout_session_id: data.id,
              stripe_account_id: event.account ?? null,
              user_id: data.metadata.userId,       // Already a Supabase UUID
              product_id: item.price.product.metadata.id,
              // NOTE: no 'name' field — orders table has no name column
            });
          }
          break;

        case "account.updated":
          data = event.data.object as Stripe.Account;

          await supabaseAdmin
            .from("tenants")
            .update({ stripe_details_submitted: data.details_submitted })
            .eq("stripe_account_id", data.id);
          break;

        default:
          throw new Error(`Unhandled event: ${event.type}`);
      }
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: "Webhook handler failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "Received" }, { status: 200 });
}

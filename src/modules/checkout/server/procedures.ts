import z from "zod";
import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";

import { stripe } from "@/lib/stripe";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";

import { CheckoutMetadata, ProductMetadata } from "../types";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants";
import { generateTenantURL } from "@/lib/utils";

export const checkoutRouter = createTRPCRouter({
  verify: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Step 1: Get the user's tenant_id via user_tenants join table
      // (New Supabase users have no Payload user record — this replaces ctx.db.findByID({ collection: "users" }))
      const { data: userTenant } = await ctx.supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      if (!userTenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User has no associated tenant",
        });
      }

      // Step 2: Get tenant's stripe_account_id
      const { data: tenant } = await ctx.supabase
        .from("tenants")
        .select("stripe_account_id")
        .eq("id", userTenant.tenant_id)
        .single();

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const accountLink = await stripe.accountLinks.create({
        account: tenant.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
        type: "account_onboarding",
      });

      if (!accountLink.url) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to create verification link",
        });
      }

      return { url: accountLink.url };
    }),

  purchase: protectedProcedure
    .input(
      z.object({
        productIds: z.array(z.string()).min(1),
        tenantSlug: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Step 1: Resolve tenantSlug → tenant_id
      const { data: tenantRow } = await ctx.supabase
        .from("tenants")
        .select("id, stripe_account_id, stripe_details_submitted")
        .eq("slug", input.tenantSlug)
        .maybeSingle();

      if (!tenantRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      if (!tenantRow.stripe_details_submitted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant not allowed to sell products",
        });
      }

      // Step 2: Fetch products filtered by tenant_id + ids + not archived
      const { data: productsData } = await ctx.supabase
        .from("products")
        .select("id, name, price")
        .in("id", input.productIds)
        .eq("tenant_id", tenantRow.id)
        .eq("is_archived", false);

      const products = productsData ?? [];

      if (products.length !== input.productIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Products not found" });
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.map((product) => ({
          quantity: 1,
          price_data: {
            unit_amount: product.price * 100,
            currency: "usd",
            product_data: {
              name: product.name,
              metadata: {
                stripeAccountId: tenantRow.stripe_account_id,
                id: product.id,
                name: product.name,
                price: product.price,
              } as ProductMetadata,
            },
          },
        }));

      const totalAmount = products.reduce((acc, item) => acc + item.price * 100, 0);
      const platformFeeAmount = Math.round(totalAmount * (PLATFORM_FEE_PERCENTAGE / 100));

      const domain = generateTenantURL(input.tenantSlug);

      const checkout = await stripe.checkout.sessions.create(
        {
          customer_email: ctx.user.email!,
          success_url: `${domain}/checkout?success=true`,
          cancel_url: `${domain}/checkout?cancel=true`,
          mode: "payment",
          line_items: lineItems,
          invoice_creation: { enabled: true },
          metadata: { userId: ctx.user.id } as CheckoutMetadata,
          payment_intent_data: { application_fee_amount: platformFeeAmount },
        },
        { stripeAccount: tenantRow.stripe_account_id }
      );

      if (!checkout.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

      return { url: checkout.url };
    }),

  getProducts: baseProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("products")
        .select(
          "*, image:media!image_id(*), tenant:tenants!tenant_id(*, image:media!image_id(*))"
        )
        .in("id", input.ids)
        .eq("is_archived", false);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const docs = data ?? [];

      if (docs.length !== input.ids.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Products not found" });
      }

      const totalPrice = docs.reduce((acc, product) => {
        const price = Number(product.price);
        return acc + (isNaN(price) ? 0 : price);
      }, 0);

      return {
        docs,
        totalDocs: docs.length,
        totalPrice,
      };
    }),
});

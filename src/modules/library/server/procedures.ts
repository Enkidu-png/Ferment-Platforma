import z from "zod";
import { TRPCError } from "@trpc/server";
import type { Tables } from "@/lib/supabase/types";

import { DEFAULT_LIMIT } from "@/constants";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

type ProductWithReviews = Tables<"products"> & {
  image: Tables<"media"> | null;
  tenant: (Tables<"tenants"> & { image: Tables<"media"> | null }) | null;
  reviewCount: number;
  reviewRating: number;
};

export const libraryRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the user has purchased this product
      const { data: order } = await ctx.supabase
        .from("orders")
        .select("id")
        .eq("product_id", input.productId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const { data: product, error } = await ctx.supabase
        .from("products")
        .select("*, image:media!image_id(*), tenant:tenants!tenant_id(*, image:media!image_id(*))")
        .eq("id", input.productId)
        .single();

      if (error || !product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      return product;
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),
      }),
    )
    .query(async ({ ctx, input }) => {
      const from = (input.cursor - 1) * input.limit;
      const to = from + input.limit - 1;

      // Step 1: Fetch the user's orders (paginated by order) with count
      const { data: orderRows, count: totalDocs } = await ctx.supabase
        .from("orders")
        .select("product_id", { count: "exact" })
        .eq("user_id", ctx.user.id)
        .range(from, to);

      const productIds = (orderRows ?? []).map((o) => o.product_id);

      if (productIds.length === 0) {
        return {
          docs: [],
          totalDocs: totalDocs ?? 0,
          page: input.cursor,
          limit: input.limit,
          totalPages: Math.ceil((totalDocs ?? 0) / input.limit),
          hasNextPage: input.cursor * input.limit < (totalDocs ?? 0),
          hasPrevPage: input.cursor > 1,
        };
      }

      // Step 2: Fetch products for those order IDs
      const { data: productsData } = await ctx.supabase
        .from("products")
        .select("*, image:media!image_id(*), tenant:tenants!tenant_id(*, image:media!image_id(*))")
        .in("id", productIds);

      const products = productsData ?? [];

      // Step 3: N+1 review ratings (acceptable for current scale)
      const docsWithReviews: ProductWithReviews[] = await Promise.all(
        products.map(async (doc) => {
          const { data: reviewRows } = await ctx.supabase
            .from("reviews")
            .select("rating")
            .eq("product_id", doc.id);

          const reviews = reviewRows ?? [];
          return {
            ...doc,
            reviewCount: reviews.length,
            reviewRating:
              reviews.length === 0
                ? 0
                : reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length,
          } as ProductWithReviews;
        })
      );

      const total = totalDocs ?? 0;

      return {
        docs: docsWithReviews,
        totalDocs: total,
        page: input.cursor,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
        hasNextPage: input.cursor * input.limit < total,
        hasPrevPage: input.cursor > 1,
      };
    }),
});

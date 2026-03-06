import z from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const reviewsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify product exists
      const { data: product } = await ctx.supabase
        .from("products")
        .select("id")
        .eq("id", input.productId)
        .maybeSingle();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      const { data: review } = await ctx.supabase
        .from("reviews")
        .select("*")
        .eq("product_id", input.productId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      return review ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        rating: z.number().min(1, { message: "Rating is required" }).max(5),
        description: z.string().min(1, { message: "Description is required" }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data: product } = await ctx.supabase
        .from("products")
        .select("id")
        .eq("id", input.productId)
        .maybeSingle();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      const { data: existing } = await ctx.supabase
        .from("reviews")
        .select("id")
        .eq("product_id", input.productId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already reviewed this product",
        });
      }

      const { data: review, error } = await ctx.supabase
        .from("reviews")
        .insert({
          user_id: ctx.user.id,
          product_id: input.productId,
          rating: input.rating,
          description: input.description,
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return review;
    }),

  update: protectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        rating: z.number().min(1, { message: "Rating is required" }).max(5),
        description: z.string().min(1, { message: "Description is required" }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data: existingReview } = await ctx.supabase
        .from("reviews")
        .select("*")
        .eq("id", input.reviewId)
        .maybeSingle();

      if (!existingReview) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      // Application-level ownership check (RLS also enforces this)
      if (existingReview.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to update this review",
        });
      }

      const { data: updatedReview, error } = await ctx.supabase
        .from("reviews")
        .update({ rating: input.rating, description: input.description })
        .eq("id", input.reviewId)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return updatedReview;
    }),
});

import z from "zod";
import { TRPCError } from "@trpc/server";
import type { Tables } from "@/lib/supabase/types";

import { baseProcedure, createTRPCRouter } from "@/trpc/init";

type TenantWithImage = Tables<"tenants"> & {
  image: Tables<"media"> | null;
};

export const tenantsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(
      z.object({
        slug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { data: tenant, error } = await ctx.supabase
        .from("tenants")
        .select("*, image:media!image_id(*)")
        .eq("slug", input.slug)
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      return tenant as unknown as TenantWithImage;
    }),
});

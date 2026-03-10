import z from "zod";
import { DEFAULT_LIMIT } from "@/constants";
import { adminProcedure, baseProcedure, createTRPCRouter } from "@/trpc/init";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const tagsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),
      }),
    )
    .query(async ({ ctx, input }) => {
      const from = (input.cursor - 1) * input.limit;
      const to = from + input.limit - 1;

      const { data, count, error } = await ctx.supabase
        .from("tags")
        .select("*", { count: "exact" })
        .range(from, to);

      if (error) throw new Error(error.message);

      const docs = data ?? [];
      const totalDocs = count ?? 0;

      return {
        docs,
        totalDocs,
        page: input.cursor,
        limit: input.limit,
        totalPages: Math.ceil(totalDocs / input.limit),
        hasNextPage: input.cursor * input.limit < totalDocs,
        hasPrevPage: input.cursor > 1,
      };
    }),

  adminGetAllTags: adminProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }),

  adminCreateTag: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabaseAdmin
        .from("tags")
        .insert({ name: input.name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }),

  adminUpdateTag: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("tags")
        .update({ name: input.name })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  adminDeleteTag: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("tags")
        .delete()
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),
});

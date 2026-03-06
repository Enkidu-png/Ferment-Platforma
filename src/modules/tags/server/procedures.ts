import z from "zod";
import { DEFAULT_LIMIT } from "@/constants";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";

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
});

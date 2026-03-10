import z from "zod";
import type { Tables } from "@/lib/supabase/types";
import { adminProcedure, baseProcedure, createTRPCRouter } from "@/trpc/init";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Category = Tables<"categories"> & {
  subcategories: Tables<"categories">[];
};

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("categories")
      .select("*, subcategories:categories!parent_id(*)")
      .is("parent_id", null);

    if (error) throw new Error(error.message);

    const docs = (data ?? []) as unknown as Category[];

    // Custom sort order: All first, then specified order, alphabetical for rest
    const customOrder = ['all', 'clothes', 'jewelery', 'posters', 'pottery', 'tattoos', 'music', 'accessories'];
    const sorted = docs.sort((a, b) => {
      const aIndex = customOrder.indexOf(a.slug);
      const bIndex = customOrder.indexOf(b.slug);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((doc) => ({
      ...doc,
      subcategories: (doc.subcategories ?? []),
    }));
  }),

  adminGetAllCategories: adminProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id, name, slug, parent_id")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }),

  adminCreateCategory: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100),
      parentId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabaseAdmin
        .from("categories")
        .insert({
          name: input.name,
          slug: input.slug,
          parent_id: input.parentId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }),

  adminUpdateCategory: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("categories")
        .update({ name: input.name, slug: input.slug })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  adminDeleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Guard: check if any products reference this category
      const { count, error: countError } = await supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", input.id);

      if (countError) throw new Error(countError.message);

      if ((count ?? 0) > 0) {
        throw new Error(`Cannot delete: ${count} product(s) use this category. Reassign them first.`);
      }

      const { error } = await supabaseAdmin
        .from("categories")
        .delete()
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),
});

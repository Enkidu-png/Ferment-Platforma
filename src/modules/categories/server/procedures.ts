import type { Tables } from "@/lib/supabase/types";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";

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
});

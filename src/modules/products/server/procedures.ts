import z from "zod";
import { TRPCError } from "@trpc/server";
import type { Tables } from "@/lib/supabase/types";

import { DEFAULT_LIMIT } from "@/constants";
import { adminProcedure, baseProcedure, createTRPCRouter } from "@/trpc/init";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { sortValues } from "../search-params";

type Media = Tables<"media">;
type Tenant = Tables<"tenants"> & { image: Media | null };
type Category = Tables<"categories">;

type AdminProductRow = {
  id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
  tenant: { id: string; name: string; slug: string } | null;
};

type ProductRow = Tables<"products"> & {
  image: Media | null;
  tenant: Tenant | null;
  category: Category | null;
};

type ProductRowWithReviews = ProductRow & {
  reviewCount: number;
  reviewRating: number;
};

type PaginatedEmpty = {
  docs: ProductRowWithReviews[];
  totalDocs: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

function emptyPage(input: { cursor: number; limit: number }): PaginatedEmpty {
  return {
    docs: [] as ProductRowWithReviews[],
    totalDocs: 0,
    page: input.cursor,
    limit: input.limit,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };
}

async function findTenantId(
  tenantSlug: string,
  supabase: typeof supabaseAdmin,
): Promise<string | null> {
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();
  return data?.id ?? null;
}

async function findProductIdsByTags(
  tags: string[],
  supabase: typeof supabaseAdmin,
): Promise<string[] | null> {
  const { data: tagRows } = await supabase
    .from("tags")
    .select("id")
    .in("name", tags);

  if (!tagRows || tagRows.length === 0) return null;

  const { data: ptRows } = await supabase
    .from("product_tags")
    .select("product_id")
    .in("tag_id", tagRows.map((t) => t.id));

  const productIds = (ptRows ?? []).map((pt) => pt.product_id);
  return productIds.length === 0 ? null : productIds;
}

export const productsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data: rawProduct, error } = await ctx.supabase
        .from("products")
        .select(
          "id, name, description, price, is_archived, is_private, refund_policy, " +
          "image:media!image_id(*), " +
          "tenant:tenants!tenant_id(*, image:media!image_id(*)), " +
          "category:categories!category_id(*)"
        )
        .eq("id", input.id)
        .single();

      const product = rawProduct as unknown as ProductRow | null;

      if (error || !product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      if (product.is_archived) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      let isPurchased = false;

      if (ctx.user) {
        const { data: order } = await ctx.supabase
          .from("orders")
          .select("id")
          .eq("product_id", input.id)
          .eq("user_id", ctx.user.id)
          .maybeSingle();

        isPurchased = !!order;
      }

      const { data: reviewRows } = await ctx.supabase
        .from("reviews")
        .select("rating")
        .eq("product_id", input.id);

      const reviews = reviewRows ?? [];
      const totalDocs = reviews.length;

      const reviewRating =
        totalDocs > 0
          ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalDocs
          : 0;

      const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

      if (totalDocs > 0) {
        reviews.forEach((r) => {
          if (r.rating >= 1 && r.rating <= 5) {
            ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
          }
        });
        Object.keys(ratingDistribution).forEach((key) => {
          const rating = Number(key);
          const val = ratingDistribution[rating] ?? 0;
          ratingDistribution[rating] = Math.round((val / totalDocs) * 100);
        });
      }

      return {
        ...product,
        isPurchased,
        reviewRating,
        reviewCount: totalDocs,
        ratingDistribution,
      };
    }),
  getMany: baseProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),
        search: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        sort: z.enum(sortValues).nullable().optional(),
        tenantSlug: z.string().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const from = (input.cursor - 1) * input.limit;
      const to = from + input.limit - 1;

      // Build query
      let query = ctx.supabase
        .from("products")
        .select(
          "id, name, description, price, is_archived, is_private, refund_policy, " +
          "image:media!image_id(*), " +
          "tenant:tenants!tenant_id(*, image:media!image_id(*)), " +
          "category:categories!category_id(*)",
          { count: "exact" }
        )
        .eq("is_archived", false);

      // Tenant slug filter (two-step)
      if (input.tenantSlug) {
        const tenantId = await findTenantId(input.tenantSlug, ctx.supabase as typeof supabaseAdmin);
        if (!tenantId) return emptyPage(input);
        query = query.eq("tenant_id", tenantId);
      } else {
        // Global marketplace — hide private products
        query = query.eq("is_private", false);
      }

      // Price filters
      if (input.minPrice) query = query.gte("price", Number(input.minPrice));
      if (input.maxPrice) query = query.lte("price", Number(input.maxPrice));

      // Search filter
      if (input.search) query = query.ilike("name", `%${input.search}%`);

      // Category filter (two-step: fetch parent + subcategory IDs)
      if (input.category) {
        const { data: cat } = await ctx.supabase
          .from("categories")
          .select("id, subcategories:categories!parent_id(id)")
          .eq("slug", input.category)
          .maybeSingle();

        if (cat) {
          const catTyped = cat as unknown as { id: string; subcategories: { id: string }[] | null };
          const categoryIds = [
            catTyped.id,
            ...(catTyped.subcategories ?? []).map((s) => s.id),
          ];
          query = query.in("category_id", categoryIds);
        }
      }

      // Tag filter (three-step: tag names → tag IDs → product IDs)
      if (input.tags && input.tags.length > 0) {
        const productIds = await findProductIdsByTags(input.tags, ctx.supabase as typeof supabaseAdmin);
        if (!productIds) return emptyPage(input);
        query = query.in("id", productIds);
      }

      // Sort
      const ascending = input.sort === "hot_and_new";
      query = query.order("created_at", { ascending });

      // Pagination
      query = query.range(from, to);

      const { data: rawData, count, error } = await query;

      if (error) throw new Error(error.message);

      const docs = (rawData ?? []) as unknown as ProductRow[];
      const totalDocs = count ?? 0;

      // N+1 review ratings — acceptable for current data volume (20 products)
      const docsWithReviews: ProductRowWithReviews[] = await Promise.all(
        docs.map(async (doc) => {
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
          };
        })
      );

      return {
        docs: docsWithReviews,
        totalDocs,
        page: input.cursor,
        limit: input.limit,
        totalPages: Math.ceil(totalDocs / input.limit),
        hasNextPage: input.cursor * input.limit < totalDocs,
        hasPrevPage: input.cursor > 1,
      };
    }),

  adminGetProducts: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      tenantName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      let query = supabaseAdmin
        .from("products")
        .select(
          "id, name, is_archived, created_at, " +
          "tenant:tenants!tenant_id(id, name, slug)"
        )
        .order("created_at", { ascending: false });

      if (input.search && input.search.trim() !== "") {
        query = query.ilike("name", `%${input.search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let rows = (data ?? []) as unknown as AdminProductRow[];

      // Filter by merchant name client-side after fetch.
      // Supabase does not support .ilike() on embedded foreign-table columns
      // in the same query chain; post-fetch filter is safe at admin scale.
      if (input.tenantName && input.tenantName.trim() !== "") {
        const needle = input.tenantName.trim().toLowerCase();
        rows = rows.filter((p) =>
          p.tenant?.name?.toLowerCase().includes(needle)
        );
      }

      return rows;
    }),

  adminArchiveProduct: adminProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ is_archived: true })
        .eq("id", input.productId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  adminRestoreProduct: adminProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ is_archived: false })
        .eq("id", input.productId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),
});

import z from "zod";
import { TRPCError } from "@trpc/server";
import type { Tables } from "@/lib/supabase/types";

import { adminProcedure, baseProcedure, createTRPCRouter } from "@/trpc/init";
import { supabaseAdmin } from "@/lib/supabase/admin";

type TenantWithImage = Tables<"tenants"> & {
  image: Tables<"media"> | null;
};

type AdminTenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  email: string | null;
  products: Array<{
    id: string;
    name: string;
    image: { id: string; url: string } | null;
  }>;
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

  adminGetTenants: adminProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "suspended"]) }))
    .query(async ({ input }) => {
      // Step 1: Fetch tenants with their products and the user_tenants junction row
      type RawTenantRow = {
        id: string;
        name: string;
        slug: string;
        status: string;
        created_at: string;
        user_tenants: Array<{ user_id: string }>;
        products: Array<{
          id: string;
          name: string;
          image: { id: string; url: string } | null;
        }>;
      };

      const { data, error } = await supabaseAdmin
        .from("tenants")
        .select(
          "id, name, slug, status, created_at, " +
          "user_tenants(user_id), " +
          "products:products!tenant_id(id, name, image:media!image_id(id, url))"
        )
        .eq("status", input.status)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const tenants = (data ?? []) as unknown as RawTenantRow[];
      if (tenants.length === 0) return [] as AdminTenantRow[];

      // Step 2: Collect all user_ids, then fetch emails in one listUsers call
      // listUsers returns up to 1000 users by default — sufficient for admin dataset
      const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      const emailMap = new Map<string, string>();
      for (const u of usersPage?.users ?? []) {
        emailMap.set(u.id, u.email ?? "");
      }

      // Step 3: Merge email into each tenant row
      return tenants.map((t) => {
        const userId = t.user_tenants[0]?.user_id;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          created_at: t.created_at,
          email: userId ? (emailMap.get(userId) ?? null) : null,
          products: t.products,
        } satisfies AdminTenantRow;
      });
    }),

  adminApproveTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("tenants")
        .update({ status: "approved" })
        .eq("id", input.tenantId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  adminRejectTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("tenants")
        .update({ status: "rejected" })
        .eq("id", input.tenantId);
      if (error) throw new Error(error.message);
      return { success: true };
      // Note: Email notification for rejected merchants is deferred to Phase 7
      // alongside AUTH-05 (transactional email setup). Status change is the
      // implemented part of ADMN-03 for Phase 6.
    }),

  adminUndoTenantDecision: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("tenants")
        .update({ status: "pending" })
        .eq("id", input.tenantId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),
});

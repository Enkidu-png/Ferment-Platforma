import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminOrderRow = {
  id: string;
  created_at: string;
  stripe_checkout_session_id: string | null;
  product: {
    id: string;
    name: string;
    tenant: { id: string; name: string; slug: string } | null;
  } | null;
  buyer: { id: string; username: string } | null;
};

export const ordersRouter = createTRPCRouter({
  adminGetOrders: adminProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, stripe_checkout_session_id, " +
        "product:products!product_id(id, name, tenant:tenants!tenant_id(id, name, slug)), " +
        "buyer:users!user_id(id, username)"
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminOrderRow[];
  }),
});

import { OrdersView } from "@/modules/admin/ui/views/orders-view";

export default function OrdersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Orders</h1>
      <OrdersView />
    </div>
  );
}

'use client';
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OrdersView() {
  const trpc = useTRPC();
  const { data: orders = [], isLoading } = useQuery(
    trpc.orders.adminGetOrders.queryOptions(undefined, {
      refetchOnWindowFocus: false,
    })
  );

  if (isLoading) return <p className="text-muted-foreground">Loading orders...</p>;
  if (orders.length === 0) return <p className="text-muted-foreground">No orders yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {order.id.slice(0, 8)}&hellip;
            </TableCell>
            <TableCell>{order.product?.name ?? "—"}</TableCell>
            <TableCell>{order.product?.tenant?.name ?? "—"}</TableCell>
            <TableCell>{order.buyer?.username ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

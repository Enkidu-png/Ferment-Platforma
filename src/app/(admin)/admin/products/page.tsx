import { ProductsView } from "@/modules/admin/ui/views/products-view";

export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Products</h1>
      <ProductsView />
    </div>
  );
}

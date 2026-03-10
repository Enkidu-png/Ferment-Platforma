'use client';
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function ProductsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [debouncedTenantName, setDebouncedTenantName] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTenantName(tenantName), 300);
    return () => clearTimeout(timer);
  }, [tenantName]);

  const { data: products = [], isLoading } = useQuery(
    trpc.products.adminGetProducts.queryOptions(
      { search: debouncedSearch, tenantName: debouncedTenantName },
      { refetchOnWindowFocus: false }
    )
  );

  const invalidateProducts = () => {
    queryClient.invalidateQueries(
      trpc.products.adminGetProducts.queryFilter()
    );
  };

  const archiveMutation = useMutation(
    trpc.products.adminArchiveProduct.mutationOptions({
      onSuccess: () => {
        invalidateProducts();
        toast.success("Product archived");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const restoreMutation = useMutation(
    trpc.products.adminRestoreProduct.mutationOptions({
      onSuccess: () => {
        invalidateProducts();
        toast.success("Product restored");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Input
          placeholder="Filter by merchant..."
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">No products found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                className={product.is_archived ? "opacity-50" : ""}
              >
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.tenant?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={product.is_archived ? "secondary" : "default"}>
                    {product.is_archived ? "Archived" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(product.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {product.is_archived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate({ productId: product.id })}
                      disabled={restoreMutation.isPending}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => archiveMutation.mutate({ productId: product.id })}
                      disabled={archiveMutation.isPending}
                    >
                      Archive
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

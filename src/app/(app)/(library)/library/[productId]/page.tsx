import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";

import { ProductView, ProductViewSkeleton } from "@/modules/library/ui/views/product-view";
import { Suspense } from "react";

interface Props {
  params: Promise<{
    productId: string;
  }>
}

export const dynamic = "force-dynamic";

const Page = async ({ params }: Props) => {
  const { productId } = await params;

  const queryClient = getQueryClient();
  queryClient.prefetchQuery(trpc.library.getOne.queryOptions({
    productId,
  })).catch(() => {});

  queryClient.prefetchQuery(trpc.reviews.getOne.queryOptions({
    productId,
  })).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ProductViewSkeleton />}>
        <ProductView productId={productId} />
      </Suspense>
    </HydrationBoundary>
  );
};
 
export default Page;

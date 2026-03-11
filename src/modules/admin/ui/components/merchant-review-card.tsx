'use client';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type AdminTenantRow = {
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

interface MerchantReviewCardProps {
  tenant: AdminTenantRow;
  onApprove: () => void;
  onReject: () => void;
  onSkip: () => void;
  onUndo: () => void;
  canUndo: boolean;
  isLoading: boolean;
}

export function MerchantReviewCard({
  tenant,
  onApprove,
  onReject,
  onSkip,
  onUndo,
  canUndo,
  isLoading,
}: MerchantReviewCardProps) {
  const hasImages = tenant.products.some((p) => p.image?.url);

  return (
    <Card className="max-w-sm w-full mx-auto">
      <CardContent className="p-4 space-y-4">
        {/* Product photo carousel */}
        <Carousel className="w-full">
          <CarouselContent>
            {hasImages ? (
              tenant.products.map((product) =>
                product.image?.url ? (
                  <CarouselItem key={product.id}>
                    <img
                      src={product.image.url}
                      alt={product.name}
                      className="w-full aspect-square object-cover rounded-md"
                    />
                  </CarouselItem>
                ) : null
              )
            ) : (
              <CarouselItem>
                <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm rounded-md">
                  No product images
                </div>
              </CarouselItem>
            )}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        {/* Merchant info */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{tenant.name}</h2>

          <a
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            View shop /{tenant.slug}
          </a>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Registered:</span>{" "}
            {new Date(tenant.created_at).toLocaleDateString()}
          </p>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Email:</span> {tenant.email ?? "—"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onReject}
            disabled={isLoading}
          >
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isLoading}
          >
            ?
          </Button>
          <Button
            variant="outline"
            onClick={onUndo}
            disabled={isLoading || !canUndo}
          >
            Undo
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={onApprove}
            disabled={isLoading}
          >
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

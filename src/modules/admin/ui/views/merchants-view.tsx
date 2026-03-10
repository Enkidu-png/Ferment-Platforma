'use client';

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MerchantReviewCard,
  type AdminTenantRow,
} from "@/modules/admin/ui/components/merchant-review-card";

export function MerchantsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastAction, setLastAction] = useState<{
    tenantId: string;
    action: "approve" | "reject";
  } | null>(null);

  const { data: pendingTenants = [], isLoading: loadingPending } = useQuery(
    trpc.tenants.adminGetTenants.queryOptions({ status: "pending" })
  );

  const { data: approvedTenants = [], isLoading: loadingApproved } = useQuery(
    trpc.tenants.adminGetTenants.queryOptions({ status: "active" })
  );

  const invalidateTenants = () => {
    queryClient.invalidateQueries(
      trpc.tenants.adminGetTenants.queryFilter()
    );
  };

  const approveMutation = useMutation(
    trpc.tenants.adminApproveTenant.mutationOptions({
      onSuccess: () => {
        invalidateTenants();
        toast.success("Merchant approved");
      },
      onError: (err: { message: string }) => {
        toast.error(`Failed to approve: ${err.message}`);
      },
    })
  );

  const rejectMutation = useMutation(
    trpc.tenants.adminRejectTenant.mutationOptions({
      onSuccess: () => {
        invalidateTenants();
        toast.success("Merchant rejected");
      },
      onError: (err: { message: string }) => {
        toast.error(`Failed to reject: ${err.message}`);
      },
    })
  );

  const undoMutation = useMutation(
    trpc.tenants.adminUndoTenantDecision.mutationOptions({
      onSuccess: () => {
        invalidateTenants();
        toast.success("Decision undone — merchant returned to pending");
      },
      onError: (err: { message: string }) => {
        toast.error(`Failed to undo: ${err.message}`);
      },
    })
  );

  const currentTenant: AdminTenantRow | undefined = pendingTenants[currentIndex];

  const isLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    undoMutation.isPending;

  const handleApprove = () => {
    if (!currentTenant) return;
    approveMutation.mutate({ tenantId: currentTenant.id });
    setLastAction({ tenantId: currentTenant.id, action: "approve" });
    setCurrentIndex((i) => i + 1);
  };

  const handleReject = () => {
    if (!currentTenant) return;
    rejectMutation.mutate({ tenantId: currentTenant.id });
    setLastAction({ tenantId: currentTenant.id, action: "reject" });
    setCurrentIndex((i) => i + 1);
  };

  const handleSkip = () => {
    setCurrentIndex((i) => i + 1);
  };

  const handleUndo = () => {
    if (!lastAction) return;
    undoMutation.mutate({ tenantId: lastAction.tenantId });
    setCurrentIndex((i) => Math.max(0, i - 1));
    setLastAction(null);
  };

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-6">
        {loadingPending ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : pendingTenants.length === 0 || currentIndex >= pendingTenants.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No pending merchants</p>
            <p className="text-sm mt-1">All merchant applications have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {pendingTenants.length - currentIndex} of {pendingTenants.length} merchants remaining
            </p>
            <MerchantReviewCard
              tenant={currentTenant!}
              onApprove={handleApprove}
              onReject={handleReject}
              onSkip={handleSkip}
              onUndo={handleUndo}
              canUndo={lastAction !== null}
              isLoading={isLoading}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="approved" className="mt-6">
        {loadingApproved ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : approvedTenants.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            No approved merchants yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedTenants.map((tenant: AdminTenantRow) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.email ?? "—"}</TableCell>
                  <TableCell>
                    <a
                      href={`/${tenant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 text-sm"
                    >
                      /{tenant.slug}
                    </a>
                  </TableCell>
                  <TableCell>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  );
}

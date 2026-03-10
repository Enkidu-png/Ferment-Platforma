'use client';
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TagsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: tags = [], isLoading } = useQuery(
    trpc.tags.adminGetAllTags.queryOptions()
  );

  useEffect(() => {
    if (tags.length > 0) {
      setEdits(Object.fromEntries(tags.map((t) => [t.id, t.name])));
    }
  }, [tags]);

  const invalidateTags = () => {
    queryClient.invalidateQueries(trpc.tags.adminGetAllTags.queryFilter());
  };

  const createMutation = useMutation(
    trpc.tags.adminCreateTag.mutationOptions({
      onSuccess: () => {
        invalidateTags();
        setNewName("");
        toast.success("Tag created");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.tags.adminUpdateTag.mutationOptions({
      onSuccess: () => {
        invalidateTags();
        toast.success("Tag updated");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.tags.adminDeleteTag.mutationOptions({
      onSuccess: () => {
        invalidateTags();
        toast.success("Tag deleted");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-muted-foreground">Loading tags...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => {
              const name = edits[tag.id] ?? tag.name;
              return (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Input
                      value={name}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [tag.id]: e.target.value }))
                      }
                      className="max-w-xs"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateMutation.mutate({ id: tag.id, name })
                        }
                        disabled={updateMutation.isPending}
                      >
                        Save
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{tag.name}&quot;? This
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: tag.id })}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Add Tag row */}
            <TableRow>
              <TableCell>
                <Input
                  placeholder="New tag name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="max-w-xs"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate({ name: newName })}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  Add Tag
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

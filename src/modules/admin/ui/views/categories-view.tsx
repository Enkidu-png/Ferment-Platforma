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

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function CategoriesView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, { name: string; slug: string }>>({});

  const { data: categories = [], isLoading } = useQuery(
    trpc.categories.adminGetAllCategories.queryOptions()
  );

  useEffect(() => {
    if (categories.length > 0) {
      setEdits(
        Object.fromEntries(
          categories.map((c) => [c.id, { name: c.name, slug: c.slug ?? "" }])
        )
      );
    }
  }, [categories]);

  const invalidateCategories = () => {
    queryClient.invalidateQueries(
      trpc.categories.adminGetAllCategories.queryFilter()
    );
  };

  const createMutation = useMutation(
    trpc.categories.adminCreateCategory.mutationOptions({
      onSuccess: () => {
        invalidateCategories();
        setNewName("");
        toast.success("Category created");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const updateMutation = useMutation(
    trpc.categories.adminUpdateCategory.mutationOptions({
      onSuccess: () => {
        invalidateCategories();
        toast.success("Category updated");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const deleteMutation = useMutation(
    trpc.categories.adminDeleteCategory.mutationOptions({
      onSuccess: () => {
        invalidateCategories();
        toast.success("Category deleted");
      },
      onError: (err: { message: string }) => toast.error(err.message),
    })
  );

  const topLevel = categories.filter((c) => c.parent_id === null);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-muted-foreground">Loading categories...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topLevel.map((category) => {
              const edit = edits[category.id] ?? { name: category.name, slug: category.slug ?? "" };
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <Input
                      value={edit.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setEdits((prev) => ({
                          ...prev,
                          [category.id]: { name, slug: slugify(name) },
                        }));
                      }}
                      className="max-w-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={edit.slug}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [category.id]: { ...edit, slug: e.target.value },
                        }))
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
                          updateMutation.mutate({
                            id: category.id,
                            name: edit.name,
                            slug: edit.slug,
                          })
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
                            <AlertDialogTitle>Delete category?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{category.name}&quot;? This
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: category.id })}
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
            {/* Add Category row */}
            <TableRow>
              <TableCell>
                <Input
                  placeholder="New category name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="max-w-xs"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={slugify(newName)}
                  readOnly
                  className="max-w-xs text-muted-foreground"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  onClick={() =>
                    createMutation.mutate({
                      name: newName,
                      slug: slugify(newName),
                      parentId: null,
                    })
                  }
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  Add Category
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

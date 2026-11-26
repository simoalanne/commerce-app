import { isDefinedError } from "@rest-rpc/core";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { DeleteOptions } from "../ui/entity-page";

type EntityDeleteDialogProps<TTarget extends { id: number }> = {
  remove: DeleteOptions;
  entityLabel: string;
  target: TTarget | null;
  onDeleteSuccess: () => void;
  getEntityName: (target: TTarget) => string;
};

export default function DeleteEntityDialog<TTarget extends { id: number }>({
  remove,
  entityLabel,
  target,
  onDeleteSuccess,
  getEntityName,
}: EntityDeleteDialogProps<TTarget>) {
  const deleteMutation = useMutation(remove);
  const entityName = target ? getEntityName(target) : undefined;

  const handleDelete = () => {
    if (!target) return;

    deleteMutation.mutate(
      { params: { id: target.id } },
      {
        async onSuccess() {
          toast.success(`${entityLabel} "${entityName}" deleted`);
          onDeleteSuccess();
        },
        onError(error) {
          toast.error(
            isDefinedError(error) && error.code === "ENTITY_IN_USE"
              ? `${entityLabel} "${entityName}" cannot be deleted because it is still in use.`
              : `Something went wrong while deleting ${entityLabel.toLowerCase()}. Please try again.`,
          );
        },
      },
    );
  };

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onDeleteSuccess()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{entityName}"?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

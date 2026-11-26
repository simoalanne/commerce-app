import type { InferClientResponse } from "@rest-rpc/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AsyncBoundary } from "@/components/async-boundary";
import DeleteEntityDialog from "@/components/forms/delete-entity-dialog";
import { ImageGrid, ImageGridSkeleton } from "@/components/image-grid";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { queryUtils } from "@/context/ApiClientContext";

import { ImageForm, type ImageFormValues } from "./ImageForm";
import { UploadImageDialog } from "./UploadImageDialog";

type ImageListItem = InferClientResponse<typeof queryUtils.images.getAll.fetch>["body"][number];

const normalizeOptionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

export default function ImagesPage() {
  return (
    <AsyncBoundary loadingFallback={<ImagesLoadingState />}>
      <ImagesContent />
    </AsyncBoundary>
  );
}

function ImagesLoadingState() {
  return (
    <div className="px-4 pb-6 lg:px-6">
      <ImageGridSkeleton count={24} />
    </div>
  );
}

function ImagesContent() {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageListItem | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const { data: images } = useSuspenseQuery(
    queryUtils.images.getAll.queryOptions({ select: (r) => r.body }),
  );

  const filteredImages = images.filter((image) => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (image.name ?? "").toLowerCase().includes(query);
  });

  return (
    <div className="px-4 pb-6 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search images by name"
          className="max-w-md min-w-[240px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setIsUploadOpen(true)}>
            Add image
          </Button>
        </div>
      </div>

      <ImageGrid
        items={filteredImages.map((image) => ({
          ...image,
          url: image.url,
          alt: image.name ?? "",
        }))}
        renderItem={(image) => (
          <div
            key={image.id}
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              className="block h-full w-full"
              onClick={() => setEditId(image.id)}
            >
              <AspectRatio ratio={1}>
                <img
                  src={image.url}
                  alt={image.name ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              </AspectRatio>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 bg-white/90 text-destructive opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(image);
              }}
              aria-label={`Delete image ${image.name ?? `#${image.id}`}`}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <UploadImageDialog
        open={isUploadOpen}
        normalizeOptionalText={normalizeOptionalText}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setIsUploadOpen(false);
          queryClient.invalidateQueries({
            queryKey: queryUtils.images.getAll.queryKey(),
          });
        }}
      />

      {editId !== null ? (
        <Dialog open={true} onOpenChange={(open) => !open && setEditId(null)}>
          <DialogContent className="max-w-2xl">
            <AsyncBoundary loadingFallback={<EditImageFallback />}>
              <EditImageDialog
                imageId={editId}
                onClose={() => setEditId(null)}
                normalizeOptionalText={normalizeOptionalText}
              />
            </AsyncBoundary>
          </DialogContent>
        </Dialog>
      ) : null}

      <DeleteEntityDialog
        remove={queryUtils.images.delete.mutationOptions()}
        entityLabel="Image"
        target={deleteTarget}
        getEntityName={(target) => target.name ?? `Image #${target.id}`}
        onDeleteSuccess={() => {
          setDeleteTarget(null);
          queryClient.invalidateQueries({
            queryKey: queryUtils.images.getAll.queryKey(),
          });
        }}
      />
    </div>
  );
}

function EditImageDialog({
  imageId,
  normalizeOptionalText,
  onClose,
}: {
  imageId: number;
  normalizeOptionalText: (value: string | null | undefined) => string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation(queryUtils.images.update.mutationOptions());
  const { data } = useSuspenseQuery(
    queryUtils.images.getById.queryOptions({
      request: { params: { id: imageId } },
      select: (r) => r.body,
    }),
  );

  const onSubmit = (values: ImageFormValues) => {
    updateMutation.mutate(
      {
        params: { id: imageId },
        body: {
          name: normalizeOptionalText(values.name),
          alt: normalizeOptionalText(values.alt),
        },
      },
      {
        onSuccess() {
          toast.success("Image updated");
          queryClient.invalidateQueries({
            queryKey: queryUtils.images.getAll.queryKey(),
          });
          onClose();
        },
        onError(error) {
          toast.error(`Failed to update image: ${error.message}`);
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit image</DialogTitle>
        <DialogDescription>Update the metadata for this asset.</DialogDescription>
      </DialogHeader>

      <ImageForm
        formId="form-images-edit"
        initialValues={{
          name: data.name ?? "",
          alt: data.alt ?? null,
        }}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        isPending={updateMutation.isPending}
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={updateMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={updateMutation.isPending}>
              Save changes
            </Button>
          </>
        }
      />
    </>
  );
}

function EditImageFallback() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit image</DialogTitle>
        <DialogDescription>Update the metadata for this asset.</DialogDescription>
      </DialogHeader>
      <ImageForm
        formId="form-images-edit"
        submitLabel="Save changes"
        onSubmit={() => {}}
        isPending={true}
        footer={
          <>
            <Button type="button" variant="outline" disabled={true}>
              Cancel
            </Button>
            <Button type="submit" disabled={true}>
              Save changes
            </Button>
          </>
        }
      />
    </>
  );
}

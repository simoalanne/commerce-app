import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

const acceptedFileTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

type UploadImageDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  normalizeOptionalText: (value: string | null | undefined) => string | null;
};

export function UploadImageDialog({
  open,
  onClose,
  onSuccess,
  normalizeOptionalText,
}: UploadImageDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const getPresignedUrlMutation = useMutation(queryUtils.images.getPresignedUrl.mutationOptions());
  const createImageMutation = useMutation(queryUtils.images.create.mutationOptions());
  const isPending = getPresignedUrlMutation.isPending || createImageMutation.isPending;

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
    }
  }, [open]);

  const handleUpload = async (values: ImageFormValues) => {
    if (!selectedFile) {
      toast.error("Select an image file before uploading.");
      return;
    }

    if (!acceptedFileTypes.has(selectedFile.type)) {
      toast.error("Only JPG, PNG, WebP, and AVIF images are supported.");
      return;
    }

    try {
      const { body: uploadSession } = await getPresignedUrlMutation.mutateAsync({
        body: {
          contentType: selectedFile.type,
          contentLength: selectedFile.size,
        },
      });
      const uploadResponse = await fetch(uploadSession.uploadUrl, {
        method: uploadSession.uploadMethod,
        headers: uploadSession.uploadHeaders,
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        toast.error(`Failed to upload image: Upload failed with status ${uploadResponse.status}`);
        return;
      }

      await createImageMutation.mutateAsync({
        body: {
          objectKey: uploadSession.objectKey,
          name: normalizeOptionalText(values.name),
          alt: normalizeOptionalText(values.alt),
        },
      });

      toast.success("Image uploaded");
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected upload error";
      toast.error(`Failed to upload image: ${message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add image</DialogTitle>
          <DialogDescription>
            Upload a managed image and save its metadata for later reuse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="image-upload-file">
            Image file
          </label>
          <Input
            id="image-upload-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={isPending}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Supported formats: JPG, PNG, WebP, AVIF. Maximum size: 10 MB.
          </p>
          {selectedFile ? (
            <p className="text-xs text-slate-600">
              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          ) : null}
        </div>

        <ImageForm
          formId="form-images-upload"
          initialValues={{
            name: "",
            alt: null,
          }}
          submitLabel="Upload image"
          onSubmit={(values) => {
            void handleUpload(values);
          }}
          isPending={isPending}
          footer={
            <>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending} form="form-images-upload">
                Upload image
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

import { IconPhotoPlus } from "@tabler/icons-react";
import { type DragEvent, useState } from "react";
import { toast } from "sonner";

import { canLoadImage, extractDroppedImageUrl, isAcceptedImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

const defaultErrorMessage =
  "Invalid image URL. The URL must be public, use HTTPS, and point to a loadable image.";

type ImageDropzoneProps = {
  variant?: "tile" | "form";
  onUrl: (url: string) => void;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  isInvalid?: boolean;
};

export function ImageDropzone({
  variant = "form",
  onUrl,
  className,
  disabled = false,
  onClick,
  isInvalid = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }

    const droppedValue = extractDroppedImageUrl(event.dataTransfer);
    if (isAcceptedImageUrl(droppedValue)) {
      const isLoadable = await canLoadImage(droppedValue);
      if (isLoadable) {
        onUrl(droppedValue);
        return;
      }
    }

    toast.error(defaultErrorMessage);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!disabled && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const baseClasses = "w-full rounded-md border border-dashed text-left transition-colors";

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        baseClasses,
        isDragging ? "border-primary bg-primary/5" : "border-border",
        isInvalid ? "border-destructive" : undefined,
        disabled ? "cursor-not-allowed opacity-70" : "",
        variant === "tile"
          ? "flex h-full flex-col items-center justify-center gap-2 p-4"
          : "bg-background p-4",
        className,
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      aria-disabled={disabled}
    >
      {variant === "tile" ? (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm">
            <IconPhotoPlus className="h-5 w-5 text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drop image URL</p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Drop image URL here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <strong>NOTE:</strong> This input does not upload images. The URL must point to an image
            that is already hosted online and publicly accessible.
            <strong>
              {" "}
              You are responsible for ensuring that you have the right to use the image and that it
              is properly licensed as necessary.
            </strong>
          </p>
        </>
      )}
    </button>
  );
}

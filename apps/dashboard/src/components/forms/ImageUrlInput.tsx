import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";

import { ImageDropzone } from "@/components/forms/ImageDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canLoadImage, isAcceptedImageUrl } from "@/lib/image-url";

const invalidImageMessage =
  "Invalid image URL. The URL must be public, use HTTPS, and point to a loadable image.";

interface ImageUrlInputProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  placeholder?: string;
}

export function ImageUrlInput<TFieldValues extends FieldValues>({
  name,
  control,
}: ImageUrlInputProps<TFieldValues>) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [manualInput, setManualInput] = useState("");

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const rawValue = typeof field.value === "string" ? field.value : "";
        const imageUrl = rawValue.trim();
        const canPreview = imageUrl.length > 0 && isAcceptedImageUrl(imageUrl);
        const hasImageUrl = imageUrl.length > 0;

        const handleManualEntry = async (nextValue: string) => {
          const trimmed = nextValue.trim();
          setManualInput("");
          if (!trimmed) {
            return;
          }
          if (!isAcceptedImageUrl(trimmed)) {
            toast.error(invalidImageMessage);
            return;
          }
          const isLoadable = await canLoadImage(trimmed);
          if (!isLoadable) {
            toast.error(invalidImageMessage);
            return;
          }
          field.onChange(trimmed);
          field.onBlur();
          setImageLoadFailed(false);
        };

        return (
          <div className="space-y-3">
            <ImageDropzone
              variant="form"
              isInvalid={fieldState.invalid}
              onUrl={(nextUrl) => {
                field.onChange(nextUrl);
                field.onBlur();
                setImageLoadFailed(false);
              }}
            />
            <Input
              value={manualInput}
              onChange={(event) => {
                void handleManualEntry(event.target.value);
              }}
              onPaste={(event) => {
                event.preventDefault();
                void handleManualEntry(event.clipboardData.getData("text/plain"));
              }}
              placeholder="Paste image URL to set"
              aria-invalid={fieldState.invalid}
            />

            <div className="group relative">
              {canPreview && !imageLoadFailed ? (
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt="Content preview"
                  className="max-h-64 w-full rounded-md border object-contain"
                  onLoad={() => setImageLoadFailed(false)}
                  onError={() => {
                    setImageLoadFailed(true);
                    toast.error(
                      "Failed to load image preview. Please check the URL and try again.",
                    );
                  }}
                />
              ) : (
                <div className="h-full max-h-64 w-full animate-pulse rounded-md border bg-muted" />
              )}
              {hasImageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-white/90 text-destructive opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:bg-white"
                  onClick={() => {
                    field.onChange("");
                    field.onBlur();
                    setImageLoadFailed(false);
                  }}
                  aria-label="Clear image"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}

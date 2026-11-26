import { IconPhoto, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { FieldLabel } from "@/components/ui/field";
import { queryUtils } from "@/context/ApiClientContext";

import { PickImagesDialog } from "./PickImagesDialog";

const emptyImagesState = (
  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
    <IconPhoto className="h-5 w-5" />
    <span>No images selected yet.</span>
  </div>
);

type MultiImagePickerProps = {
  value: number[];
  onChange: (nextValue: number[]) => void;
  label?: string;
};

export function MultiImagePicker({ value, onChange, label = "Images" }: MultiImagePickerProps) {
  const { data: images = [] } = useQuery(
    queryUtils.images.getAll.queryOptions({ select: (r) => r.body }),
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  type ImageItem = (typeof images)[number];
  const isImageItem = (item: ImageItem | undefined): item is ImageItem => Boolean(item);

  const imagesById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);

  const selectedImages = value.map((id) => imagesById.get(id)).filter(isImageItem);

  const removeImage = (id: number) => {
    onChange(value.filter((imageId) => imageId !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <FieldLabel>{label}</FieldLabel>
          <p className="text-xs text-muted-foreground">
            Select images from the gallery to associate with this item.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsPickerOpen(true)}>
          Manage images
        </Button>
      </div>

      {selectedImages.length > 0 ? (
        <div className="relative">
          <Carousel opts={{ align: "start", dragFree: true }}>
            <CarouselContent className="-ml-2">
              {selectedImages.map((image) => (
                <CarouselItem key={image.id} className="basis-1/2 pl-2 sm:basis-1/3 lg:basis-1/4">
                  <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <AspectRatio ratio={1}>
                      <img
                        src={image.url}
                        alt={image.name ?? ""}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </AspectRatio>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 bg-white/90 text-destructive opacity-0 shadow-sm transition group-hover:opacity-100"
                      onClick={() => removeImage(image.id)}
                      aria-label={`Remove image ${image.name ?? `#${image.id}`}`}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-6" />
            <CarouselNext className="-right-6" />
          </Carousel>
        </div>
      ) : (
        emptyImagesState
      )}

      <PickImagesDialog
        open={isPickerOpen}
        initialSelection={value}
        onClose={(nextSelection) => {
          setIsPickerOpen(false);
          onChange(nextSelection);
        }}
      />
    </div>
  );
}

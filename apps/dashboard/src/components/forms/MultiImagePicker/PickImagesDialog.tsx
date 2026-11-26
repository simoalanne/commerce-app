import { IconCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ImageGrid } from "@/components/image-grid";
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

type PickImagesDialogProps = {
  open: boolean;
  initialSelection: number[];
  onClose: (selection: number[]) => void;
};

export function PickImagesDialog({ open, initialSelection, onClose }: PickImagesDialogProps) {
  const { data: images = [] } = useQuery(
    queryUtils.images.getAll.queryOptions({ select: (r) => r.body }),
  );
  const [draftSelection, setDraftSelection] = useState<number[]>(initialSelection);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftSelection(initialSelection);
    setSearchQuery("");
  }, [initialSelection, open]);

  const selectedIds = new Set(draftSelection);
  const query = searchQuery.trim().toLowerCase();
  const filteredImages = query
    ? images.filter((image) => (image.name ?? "").toLowerCase().includes(query))
    : images;

  const toggleImage = (id: number) => {
    const nextSelection = selectedIds.has(id)
      ? draftSelection.filter((imageId) => imageId !== id)
      : [...draftSelection, id];
    setDraftSelection(nextSelection);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose(draftSelection);
        }
      }}
    >
      <DialogContent className="h-[80vh] w-[96vw] max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>Choose images</DialogTitle>
          <DialogDescription>
            Select as many images as you need. Click an image to toggle it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">All images</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{draftSelection.length} selected</span>
              {draftSelection.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setDraftSelection([])}
                >
                  Clear all
                </Button>
              ) : null}
            </div>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Done
              </Button>
            </DialogClose>
          </div>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search images by name"
          />
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <ImageGrid
              className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
              items={filteredImages.map((image) => ({
                ...image,
                alt: image.name ?? "",
              }))}
              renderItem={(image) => {
                const isSelected = selectedIds.has(image.id);
                return (
                  <button
                    type="button"
                    key={image.id}
                    className={
                      "group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none " +
                      (isSelected ? "ring-2 ring-primary" : "hover:border-slate-300")
                    }
                    onClick={() => toggleImage(image.id)}
                  >
                    <AspectRatio ratio={1}>
                      <img
                        src={image.url}
                        alt={image.name ?? ""}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </AspectRatio>
                    {isSelected ? (
                      <span className="absolute top-2 right-2 rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
                        <IconCheck className="h-4 w-4" />
                      </span>
                    ) : null}
                  </button>
                );
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

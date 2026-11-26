import type { ReactNode } from "react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const baseGridClasses =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";

type ImageGridItem = {
  url: string;
  alt?: string;
};

type ImageGridProps<TItem extends ImageGridItem = ImageGridItem> = {
  items: TItem[];
  className?: string;
  leading?: ReactNode;
  renderItem?: (item: TItem, index: number) => ReactNode;
};

export function ImageGrid<TItem extends ImageGridItem = ImageGridItem>({
  items,
  className,
  leading,
  renderItem,
}: ImageGridProps<TItem>) {
  return (
    <div className={cn(baseGridClasses, className)}>
      {leading}
      {items.map((item, index) =>
        renderItem ? (
          renderItem(item, index)
        ) : (
          <div
            key={`${item.url}-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <AspectRatio ratio={1}>
              <img
                src={item.url}
                alt={item.alt ?? ""}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </AspectRatio>
          </div>
        ),
      )}
    </div>
  );
}

type ImageGridSkeletonProps = {
  count?: number;
  className?: string;
};

export function ImageGridSkeleton({ count = 16, className }: ImageGridSkeletonProps) {
  return (
    <div className={cn(baseGridClasses, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`image-skeleton-${index}`}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <AspectRatio ratio={1}>
            <Skeleton className="h-full w-full" />
          </AspectRatio>
        </div>
      ))}
    </div>
  );
}

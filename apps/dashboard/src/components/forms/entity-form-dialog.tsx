import type { ReactNode } from "react";

import { ContentLocaleFlag } from "@/components/ContentLocaleFlag";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardLocalization } from "@/context/LocalizationContext";
import { cn } from "@/lib/utils";

type EntityFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
};

export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
}: EntityFormDialogProps) {
  const { contentLocale } = useDashboardLocalization();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85vh] overflow-y-auto sm:max-w-2xl", contentClassName)}>
        <DialogHeader className="gap-3 pr-8">
          <ContentLocaleFlag locale={contentLocale} />
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

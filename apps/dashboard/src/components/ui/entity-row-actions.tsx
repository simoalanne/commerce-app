import { type Icon, IconArrowRight, IconPencil, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type EntityRowActionsProps = {
  children?: ReactNode;
  entityLabel: string;
  rowId: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onNavigateDown?: () => void;
  disableNavigateDown?: boolean;
  navigateDownLabel?: string;
  navigateDownIcon?: Icon;
};

export function EntityRowActions({
  children,
  entityLabel,
  rowId,
  onEdit,
  onDelete,
  onNavigateDown,
  disableNavigateDown = false,
  navigateDownLabel,
  navigateDownIcon: NavigateDownIcon = IconArrowRight,
}: EntityRowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {onNavigateDown ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disableNavigateDown}
              className="h-8 w-8"
              aria-label={navigateDownLabel ?? `Open related items for ${entityLabel} #${rowId}`}
              onClick={(event) => {
                event.stopPropagation();
                onNavigateDown();
              }}
            >
              <NavigateDownIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {navigateDownLabel ?? `Open related items for ${entityLabel} #${rowId}`}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Edit ${entityLabel} #${rowId}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <IconPencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          aria-label={`Delete ${entityLabel} #${rowId}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      ) : null}
      {children}
    </div>
  );
}

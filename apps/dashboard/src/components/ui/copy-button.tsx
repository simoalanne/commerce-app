import { IconCopy } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label: string;
  className?: string;
};

export default function CopyButton({ value, label, className }: CopyButtonProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Copy ${label.toLowerCase()}`}
          className={cn("shrink-0", className)}
          onClick={copyToClipboard}
        >
          <IconCopy />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy {label.toLowerCase()}</TooltipContent>
    </Tooltip>
  );
}

import { type Icon, IconArrowRight } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavigateDownActionProps = {
  route: string;
  queryParams?: Record<string, string>;
  label?: string;
  icon?: Icon;
};

export function NavigateDownAction({
  route,
  queryParams,
  label,
  icon: Icon = IconArrowRight,
}: NavigateDownActionProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextSearchParams = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    nextSearchParams.set(key, value);
  }

  const query = nextSearchParams.toString();
  const href = query ? `${route}?${query}` : route;

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label ?? "Navigate"}
      onClick={(event) => {
        event.stopPropagation();
        navigate(href);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  if (!label) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

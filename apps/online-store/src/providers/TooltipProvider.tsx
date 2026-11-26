"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";

type TooltipProviderProps = {
  children: ReactNode;
};

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <RadixTooltip.Provider delayDuration={150}>{children}</RadixTooltip.Provider>;
}

import type { ReactNode } from "react";

import { TooltipProvider } from "@/providers/TooltipProvider";

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

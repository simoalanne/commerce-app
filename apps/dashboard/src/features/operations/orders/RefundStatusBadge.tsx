import { Badge } from "@/components/ui/badge";

import type { OrderTableRow } from "./OrdersPage";

type RefundSummary = OrderTableRow["refundSummary"];

const refundStatusLabels = {
  REFUND_PENDING: "Refund pending",
  REFUND_REQUIRES_MANUAL_REVIEW: "Refund requires review",
  PARTIALLY_REFUNDED: "Partially refunded",
  FULLY_REFUNDED: "Fully refunded",
} satisfies Record<Exclude<RefundSummary["status"], "NONE">, string>;

const refundStatusVariants = {
  REFUND_PENDING: "outline",
  REFUND_REQUIRES_MANUAL_REVIEW: "destructive",
  PARTIALLY_REFUNDED: "secondary",
  FULLY_REFUNDED: "destructive",
} satisfies Record<
  Exclude<RefundSummary["status"], "NONE">,
  "outline" | "secondary" | "destructive"
>;

export default function RefundStatusBadge({ refundSummary }: { refundSummary: RefundSummary }) {
  if (refundSummary.status === "NONE") {
    return null;
  }

  return (
    <Badge variant={refundStatusVariants[refundSummary.status]}>
      {refundStatusLabels[refundSummary.status]}
    </Badge>
  );
}

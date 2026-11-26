import { IconDotsVertical } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { OrderTableRow } from "./OrdersPage";

export default function OrderRowActions({
  order,
  customerLink,
  onRefund,
  onDownloadInvoice,
  onDownloadRefundReceipt,
}: {
  order: OrderTableRow;
  customerLink: string | null;
  onRefund: (order: OrderTableRow) => void;
  onDownloadInvoice: (order: OrderTableRow) => void;
  onDownloadRefundReceipt: (
    order: OrderTableRow,
    refundReceipt: OrderTableRow["refundReceipts"][number],
  ) => void;
}) {
  const isPaidOrDelivered = order.status === "PAID" || order.status === "DELIVERED";
  const disableActions = !isPaidOrDelivered;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Open actions for order #${order.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <IconDotsVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Order Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {customerLink ? (
          <>
            <DropdownMenuItem asChild onClick={(event) => event.stopPropagation()}>
              <Link to={customerLink}>View customer</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onDownloadInvoice(order);
          }}
        >
          Download invoice
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            disabled={order.refundReceipts.length === 0}
            onClick={(event) => event.stopPropagation()}
          >
            Refund receipts
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {order.refundReceipts.map((refundReceipt) => (
              <DropdownMenuItem
                key={refundReceipt.refundId}
                onClick={(event) => {
                  event.stopPropagation();
                  onDownloadRefundReceipt(order, refundReceipt);
                }}
              >
                {refundReceipt.number}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          disabled={disableActions}
          onClick={(event) => {
            event.stopPropagation();
            onRefund(order);
          }}
        >
          Refund
        </DropdownMenuItem>
        {!isPaidOrDelivered ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Available only for PAID or DELIVERED orders
            </DropdownMenuLabel>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

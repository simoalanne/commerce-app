import { downloadBlob, getContentDispositionFilename } from "@acme/shared";
import type { InferClientResponse } from "@rest-rpc/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/ui/data-table";
import EntityPage from "@/components/ui/entity-page";
import { queryUtils } from "@/context/ApiClientContext";
import OrderDetails from "@/features/operations/orders/OrderDetails";
import { formatCents } from "@/lib/money";

import OrderRowActions from "./OrderActions";
import RefundOrderDialog from "./RefundOrderDialog";
import RefundStatusBadge from "./RefundStatusBadge";

export type OrderTableRow = InferClientResponse<
  typeof queryUtils.orders.getAll.fetch
>["body"][number];

const statusVariant: Record<OrderTableRow["status"], "default" | "outline" | "secondary"> = {
  PAID: "default",
  SHIPPED: "secondary",
};

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const customerIdParam = Number(searchParams.get("customerId"));
  const [refundDialogOrder, setRefundDialogOrder] = useState<OrderTableRow | null>(null);

  const invalidateData = () => {
    queryClient.invalidateQueries({
      queryKey: queryUtils.orders.getAll.queryKey(),
    });
  };

  const openRefundDialog = (order: OrderTableRow) => {
    setRefundDialogOrder(order);
  };

  const downloadInvoice = async (order: OrderTableRow) => {
    try {
      const { body, headers } = await queryUtils.orders.downloadInvoice.fetch({
        params: { id: order.id },
      });
      downloadBlob(
        body,
        getContentDispositionFilename(headers["content-disposition"]) ?? `invoice-${order.id}.pdf`,
      );
    } catch {
      toast.error(`Failed to download invoice for order #${order.id}`);
    }
  };

  const downloadRefundReceipt = async (
    order: OrderTableRow,
    refundReceipt: OrderTableRow["refundReceipts"][number],
  ) => {
    try {
      const { body, headers } = await queryUtils.orders.downloadRefundReceipt.fetch({
        params: { id: order.id, refundId: refundReceipt.refundId },
      });
      downloadBlob(
        body,
        getContentDispositionFilename(headers["content-disposition"]) ??
          `refund-receipt-${refundReceipt.number}.pdf`,
      );
    } catch {
      toast.error(`Failed to download refund receipt ${refundReceipt.number}`);
    }
  };

  const getCustomerLabel = (contact: OrderTableRow["contact"]) => contact.name;

  const getCustomerLink = (order: OrderTableRow) =>
    order.customerId
      ? `/customers?${new URLSearchParams({
          customerId: String(order.customerId),
          customerName: getCustomerLabel(order.contact),
        }).toString()}`
      : null;

  const orderColumns: DataTableColumn<OrderTableRow>[] = [
    {
      // what
      accessorKey: "id",
      header: "Order",
      cell: ({ row }) => <div className="font-medium">#{row.original.id}</div>,
    },
    {
      // where
      id: "deliveryAddress",
      accessorFn: (row) => row.delivery.addressLabel,
      header: "Delivery Address",
      cell: ({ row }) => (
        <div className="flex max-w-xs flex-col">
          <span className="truncate">{row.original.delivery.addressLabel}</span>
        </div>
      ),
    },
    {
      // who
      id: "contact",
      accessorFn: (row) => {
        const contact = row.contact;
        return [contact.name, contact.email, contact.phone].filter(Boolean).join(" ");
      },
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col">
          {getCustomerLink(row.original) ? (
            <Link
              to={getCustomerLink(row.original) ?? ""}
              className="w-fit font-medium underline-offset-4 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {getCustomerLabel(row.original.contact)}
            </Link>
          ) : (
            <span>{getCustomerLabel(row.original.contact)}</span>
          )}
          <span className="text-xs text-muted-foreground">{row.original.contact.email}</span>
          <span className="text-xs text-muted-foreground">{row.original.contact.phone}</span>
        </div>
      ),
    },
    // amount
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => formatCents(row.original.totalCents),
    },
    // status
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status]}>{row.original.status}</Badge>
      ),
    },
    {
      id: "refundStatus",
      accessorFn: (row) => row.refundSummary.status,
      header: "Refund",
      cell: ({ row }) =>
        row.original.refundSummary.status === "NONE" ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
          <RefundStatusBadge refundSummary={row.original.refundSummary} />
        ),
    },
  ];

  return (
    <>
      <EntityPage
        list={queryUtils.orders.getAll.queryOptions({ select: (r) => r.body })}
        detail={(id) =>
          queryUtils.orders.getById.queryOptions({
            request: { params: { id } },
            select: (r) => r.body,
          })
        }
        labels={{
          singular: "Order",
          plural: "Orders",
        }}
        DialogContent={OrderDetails}
        getEntityName={(order) => `Order #${order.id}`}
        columns={() => orderColumns}
        extraRowActions={(order) => {
          return (
            <OrderRowActions
              order={order}
              customerLink={getCustomerLink(order)}
              onRefund={openRefundDialog}
              onDownloadInvoice={(selectedOrder) => void downloadInvoice(selectedOrder)}
              onDownloadRefundReceipt={(selectedOrder, refundReceipt) =>
                void downloadRefundReceipt(selectedOrder, refundReceipt)
              }
            />
          );
        }}
        searchableColumnIds={["deliveryAddress", "contact", "id"]}
        initialSorting={[{ id: "id", desc: true }]}
        rowClickOpensDialog
        rowDialogTitle="Order Details"
        dialogContentClassName="sm:max-w-5xl xl:max-w-6xl"
        actions={{ create: false, edit: false, delete: false }}
        transformData={(orders) =>
          customerIdParam ? orders.filter((order) => order.customerId === customerIdParam) : orders
        }
      />
      <RefundOrderDialog
        order={refundDialogOrder}
        onOpenChange={(open) => {
          if (!open) {
            setRefundDialogOrder(null);
          }
        }}
        onSuccess={invalidateData}
      />
    </>
  );
}

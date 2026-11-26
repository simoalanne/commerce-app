import type { InferClientResponse } from "@rest-rpc/core";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CopyButton from "@/components/ui/copy-button";
import type { EntityDialogContentProps } from "@/components/ui/entity-page";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { queryUtils } from "@/context/ApiClientContext";

import type { OrderTableRow } from "./OrdersPage";
import RefundStatusBadge from "./RefundStatusBadge";

const statusVariant: Record<OrderTableRow["status"], "default" | "outline" | "secondary"> = {
  PAID: "default",
  DELIVERED: "secondary",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type OrderDetail = InferClientResponse<typeof queryUtils.orders.getById.fetch>["body"];

type OrderDetailsProps = EntityDialogContentProps<OrderDetail>;

export default function OrderDetails({ entityData: order }: OrderDetailsProps) {
  if (!order) {
    return <div className="py-8 text-sm text-muted-foreground">Loading order details...</div>;
  }

  const total = order.pricing.chargedTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold break-all">Order #{order.id}</h3>
            <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
            <RefundStatusBadge refundSummary={order.refundSummary} />
          </div>
          <p className="text-sm text-muted-foreground">
            Placed {dateTimeFormatter.format(new Date(order.created_at))}
          </p>
        </div>
        <div className="grid shrink-0 gap-3 text-sm sm:grid-cols-2 sm:text-right">
          <div>
            <div className="text-muted-foreground">Customer</div>
            <div className="font-medium break-all">
              {order.customer_id ? `#${order.customer_id}` : "Guest checkout"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="font-medium">{currencyFormatter.format(total)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>Contact and account context</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-3">
              <DetailField
                label="Name"
                value={order.customer.name}
                copyValue={order.customer.name}
              />
              <DetailField
                label="Email"
                value={order.customer.email}
                copyValue={order.customer.email}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField
                label="Phone"
                value={order.customer.phone}
                copyValue={order.customer.phone}
              />
              <DetailField
                label="Customer ID"
                value={order.customer_id ? `#${order.customer_id}` : "Guest checkout"}
                copyValue={order.customer_id ? `#${order.customer_id}` : "Guest checkout"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
            <CardDescription>Address and access notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium break-words">{order.delivery.addressLabel}</div>
            </div>
            <details className="group rounded-lg border p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                <span className="group-open:hidden">Show delivery details</span>
                <span className="hidden group-open:inline">Hide delivery details</span>
              </summary>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <DetailField
                  label="Instructions"
                  value={formatDeliveryInstructions(order.delivery.instructions)}
                />
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {order.items.length} item{order.items.length === 1 ? "" : "s"} in this order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile layout for small screens */}
          <div className="space-y-3 sm:hidden">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xs"
              >
                <div className="flex items-start gap-3">
                  {item.productImageUrl ? (
                    <img
                      src={item.productImageUrl}
                      alt={item.productName ?? item.sku}
                      className="h-12 w-12 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm leading-tight font-medium break-words">
                      {item.productName ?? item.sku}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>SKU: {item.sku}</span>
                      {item.productId ? <span>• Product ID: {item.productId}</span> : null}
                    </div>
                  </div>
                </div>

                {item.vendorName ? (
                  <div className="rounded bg-muted/40 p-2 text-xs">
                    <span className="font-medium text-muted-foreground">Vendor:</span>{" "}
                    <span>{item.vendorName}</span>
                    {item.vendorId ? (
                      <span className="ml-1 text-muted-foreground">(ID: {item.vendorId})</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Qty: </span>
                    <span className="font-semibold">{item.quantity}</span>
                    {item.uncommittedQuantity > 0 ? (
                      <span className="ml-1.5 font-medium text-amber-600">
                        ({item.uncommittedQuantity} uncommitted)
                      </span>
                    ) : null}
                    {item.refundedQuantity && item.refundedQuantity > 0 ? (
                      <span className="ml-1.5 font-medium text-destructive">
                        ({item.refundedQuantity} refunded)
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className="mr-1 text-muted-foreground">
                      {currencyFormatter.format(item.unitPrice)} ea =
                    </span>
                    <span className="text-sm font-semibold">
                      {currencyFormatter.format(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop layout for larger screens */}
          <div className="hidden overflow-x-auto rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-[240px] whitespace-normal">
                      <div className="flex items-start gap-3">
                        {item.productImageUrl ? (
                          <img
                            src={item.productImageUrl}
                            alt={item.productName ?? item.sku}
                            className="h-14 w-14 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-md border bg-muted" />
                        )}
                        <div className="space-y-1">
                          <div className="font-medium">{item.productName ?? item.sku}</div>
                          <div className="text-xs text-muted-foreground">
                            Product ID: {item.productId ?? "-"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div>{item.vendorName ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        Vendor ID: {item.vendorId ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                      {item.uncommittedQuantity > 0 ? (
                        <div className="text-xs font-medium text-amber-600">
                          {item.uncommittedQuantity} uncommitted
                        </div>
                      ) : null}
                      {item.refundedQuantity && item.refundedQuantity > 0 ? (
                        <div className="text-xs font-medium text-destructive">
                          {item.refundedQuantity} refunded
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(item.unitPrice * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Quick financial summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PricingRow
              label="Items subtotal"
              value={currencyFormatter.format(order.pricing.itemsSubtotal)}
            />
            {order.pricing.itemsDiscountAmount !== null ? (
              <>
                <PricingRow
                  label="Item discount"
                  value={`-${currencyFormatter.format(order.pricing.itemsDiscountAmount)}`}
                />
                <PricingRow
                  label="Discounted items subtotal"
                  value={currencyFormatter.format(
                    order.pricing.discountedItemsSubtotal ?? order.pricing.itemsSubtotal,
                  )}
                />
              </>
            ) : null}
            <PricingRow
              label="Delivery fee"
              value={currencyFormatter.format(order.pricing.deliveryFee)}
            />
            {order.pricing.deliveryDiscountAmount !== null ? (
              <>
                <PricingRow
                  label="Delivery discount"
                  value={`-${currencyFormatter.format(order.pricing.deliveryDiscountAmount)}`}
                />
                <PricingRow
                  label="Discounted delivery"
                  value={currencyFormatter.format(
                    order.pricing.discountedDeliveryFee ?? order.pricing.deliveryFee,
                  )}
                />
              </>
            ) : null}
            {order.pricing.tipAmount !== null ? (
              <PricingRow
                label={`Tip${order.pricing.tipPercentage !== null ? ` (${order.pricing.tipPercentage}%)` : ""}`}
                value={currencyFormatter.format(order.pricing.tipAmount)}
              />
            ) : null}
            <Separator />
            <PricingRow label="Total" value={currencyFormatter.format(total)} emphasis />
            <PricingRow
              label={`Includes VAT ${order.pricing.vatRate}%`}
              value={currencyFormatter.format(order.pricing.includedVatAmount)}
            />
            {order.pricing.refundedAmount ? (
              <>
                <Separator />
                <PricingRow
                  label="Total refunded"
                  value={`-${currencyFormatter.format(order.pricing.refundedAmount)}`}
                  emphasis
                />
                {order.pricing.refundedDeliveryFee ? (
                  <PricingRow
                    label="Refunded delivery fee"
                    value={`-${currencyFormatter.format(order.pricing.refundedDeliveryFee)}`}
                  />
                ) : null}
                {order.pricing.refundedTipAmount ? (
                  <PricingRow
                    label="Refunded tip"
                    value={`-${currencyFormatter.format(order.pricing.refundedTipAmount)}`}
                  />
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1 break-all sm:break-words">{value}</span>
        {copyValue ? <CopyButton value={copyValue} label={label} className="shrink-0" /> : null}
      </div>
    </div>
  );
}

function PricingRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span
        className={`min-w-0 flex-1 break-words ${
          emphasis ? "font-semibold text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span className={`shrink-0 ${emphasis ? "font-semibold text-foreground" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

function formatDeliveryInstructions(
  instructions: OrderDetail["delivery"]["instructions"] | undefined,
) {
  if (!instructions) {
    return "None";
  }

  const values = [
    instructions.freeForm,
    instructions.apartmentEntrance,
    instructions.doorCode ? `Door code: ${instructions.doorCode}` : null,
  ].filter(Boolean);

  return values.length ? values.join(" | ") : "None";
}

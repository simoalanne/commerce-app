import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Textarea } from "@/components/ui/textarea";
import { queryUtils } from "@/context/ApiClientContext";

import type { OrderDetail } from "./OrderDetails";
import type { OrderTableRow } from "./OrdersPage";

type ItemRefundState = {
  quantity: number;
  restockQuantity: number | null;
  amountCents: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
});

const formatCents = (amountCents: number) => currencyFormatter.format(amountCents / 100);

const toCents = (amount: number) => Math.round(amount * 100);

const clampCents = (amountCents: number, maxAmountCents: number) =>
  Math.max(0, Math.min(maxAmountCents, amountCents));

const blockedReasonLabel = {
  ORDER_NOT_REFUNDABLE: "This order cannot be refunded.",
  REFUND_ALREADY_PENDING: "A refund is already pending for this order.",
  MISSING_PAYMENT: "This order is missing payment information.",
  NOTHING_REFUNDABLE: "There is nothing left to refund for this order.",
} satisfies Record<NonNullable<OrderDetail["refundability"]["blockedReason"]>, string>;

type RefundOrderDialogProps = {
  order: OrderTableRow | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

const customerLanguageLabel = (locale: string) => {
  try {
    return languageNames.of(locale) ?? locale;
  } catch {
    // Not a valid BCP 47 tag.
    return locale;
  }
};

export default function RefundOrderDialog({
  order,
  onOpenChange,
  onSuccess,
}: RefundOrderDialogProps) {
  const [refundReason, setRefundReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [refundConfirmText, setRefundConfirmText] = useState("");
  const [itemRefunds, setItemRefunds] = useState<Record<number, ItemRefundState>>({});
  const [deliveryFeeRefundAmountCents, setDeliveryFeeRefundAmountCents] = useState(0);
  const [tipRefundAmountCents, setTipRefundAmountCents] = useState(0);

  const refundMutation = useMutation(queryUtils.orders.refund.mutationOptions());
  const { data: detailedOrder, isLoading } = useQuery(
    queryUtils.orders.getById.queryOptions({
      request: order ? { params: { id: order.id } } : skipToken,
      select: (r) => r.body,
      enabled: order !== null,
    }),
  );

  const refundableItemByOrderItemId = useMemo(() => {
    return new Map(
      detailedOrder?.refundability.items.map((item) => [item.orderItemId, item]) ?? [],
    );
  }, [detailedOrder]);

  const selectedItems = useMemo(() => {
    if (!detailedOrder) return [];

    return detailedOrder.items.flatMap((item) => {
      const refundState = itemRefunds[item.id];
      const refundableItem = refundableItemByOrderItemId.get(item.id);
      if (!refundableItem || !refundState || refundState.amountCents <= 0) {
        return [];
      }

      return [
        {
          item,
          refundableItem,
          quantity: refundState.quantity,
          restockQuantity: refundState.restockQuantity,
          amountCents: Math.min(refundState.amountCents, refundableItem.refundableAmountCents),
        },
      ];
    });
  }, [detailedOrder, itemRefunds, refundableItemByOrderItemId]);

  const deliveryFeeAmountCents = detailedOrder
    ? Math.min(
        deliveryFeeRefundAmountCents,
        detailedOrder.refundability.deliveryFee.refundableAmountCents,
      )
    : 0;
  const tipAmountCents = detailedOrder
    ? Math.min(tipRefundAmountCents, detailedOrder.refundability.tip.refundableAmountCents)
    : 0;
  const itemsAmountCents = selectedItems.reduce((total, item) => total + item.amountCents, 0);
  const totalAmountCents = itemsAmountCents + deliveryFeeAmountCents + tipAmountCents;

  const canCreateRefund = detailedOrder?.refundability.canCreateRefund ?? false;
  const hasAnySelection = totalAmountCents > 0;
  const hasRefundReason = refundReason.trim().length > 0;
  const allRemainingSelected =
    detailedOrder != null &&
    detailedOrder.refundability.items.every((item) => {
      if (item.refundableAmountCents <= 0) {
        return true;
      }

      return (
        itemRefunds[item.orderItemId]?.quantity === item.refundableQuantity &&
        itemRefunds[item.orderItemId]?.amountCents === item.refundableAmountCents
      );
    }) &&
    (detailedOrder.refundability.deliveryFee.refundableAmountCents <= 0 ||
      deliveryFeeAmountCents === detailedOrder.refundability.deliveryFee.refundableAmountCents) &&
    (detailedOrder.refundability.tip.refundableAmountCents <= 0 ||
      tipAmountCents === detailedOrder.refundability.tip.refundableAmountCents);
  const canSubmit =
    canCreateRefund &&
    hasAnySelection &&
    hasRefundReason &&
    refundConfirmText === "REFUND" &&
    !refundMutation.isPending;

  useEffect(() => {
    if (!detailedOrder) return;
    setRefundReason("");
    setInternalNotes("");
    setRefundConfirmText("");
    setItemRefunds({});
    setDeliveryFeeRefundAmountCents(0);
    setTipRefundAmountCents(0);
  }, [detailedOrder]);

  const setRefundQuantity = (
    orderItemId: number,
    refundQuantity: number,
    maxQuantity: number,
    unitPrice: number,
    maxAmountCents: number,
  ) => {
    const clamped = Math.max(0, Math.min(maxQuantity, refundQuantity));

    setItemRefunds((prevState) => {
      const previousAmountCents = prevState[orderItemId]?.amountCents ?? 0;
      if (clamped <= 0 && previousAmountCents <= 0) {
        const next = { ...prevState };
        delete next[orderItemId];
        return next;
      }

      const amountCents =
        clamped > 0
          ? clampCents(toCents(unitPrice * clamped), maxAmountCents)
          : previousAmountCents;

      return {
        ...prevState,
        [orderItemId]: {
          quantity: clamped,
          restockQuantity: prevState[orderItemId]?.restockQuantity ?? null,
          amountCents,
        },
      };
    });
  };

  const setRefundItemSelected = (
    orderItemId: number,
    checked: boolean,
    maxQuantity: number,
    maxAmountCents: number,
  ) => {
    setItemRefunds((prevState) => {
      const next = { ...prevState };
      if (checked) {
        next[orderItemId] = {
          quantity: maxQuantity,
          restockQuantity: null,
          amountCents: maxAmountCents,
        };
      } else {
        delete next[orderItemId];
      }
      return next;
    });
  };

  const setRefundItemAmount = (
    orderItemId: number,
    amountCents: number,
    maxAmountCents: number,
  ) => {
    const clamped = clampCents(amountCents, maxAmountCents);

    setItemRefunds((prevState) => {
      const previousQuantity = prevState[orderItemId]?.quantity ?? 0;
      if (clamped <= 0) {
        const next = { ...prevState };
        delete next[orderItemId];
        return next;
      }

      return {
        ...prevState,
        [orderItemId]: {
          quantity: previousQuantity,
          restockQuantity: prevState[orderItemId]?.restockQuantity ?? null,
          amountCents: clamped,
        },
      };
    });
  };

  const setRestockQuantity = (
    orderItemId: number,
    restockQuantity: number | null,
    maxQuantity: number,
  ) => {
    const clamped =
      restockQuantity == null ? null : Math.max(0, Math.min(maxQuantity, restockQuantity));

    setItemRefunds((prevState) => {
      const previous = prevState[orderItemId];
      if (!previous) return prevState;

      return {
        ...prevState,
        [orderItemId]: {
          ...previous,
          restockQuantity: clamped,
        },
      };
    });
  };

  const toggleAllRemaining = () => {
    if (!detailedOrder || !canCreateRefund || refundMutation.isPending) {
      return;
    }

    if (allRemainingSelected) {
      setItemRefunds({});
      setDeliveryFeeRefundAmountCents(0);
      setTipRefundAmountCents(0);
      return;
    }

    setItemRefunds(
      Object.fromEntries(
        detailedOrder.refundability.items.flatMap((item) =>
          item.refundableAmountCents > 0
            ? [
                [
                  item.orderItemId,
                  {
                    quantity: item.refundableQuantity,
                    restockQuantity: null,
                    amountCents: item.refundableAmountCents,
                  },
                ],
              ]
            : [],
        ),
      ),
    );
    setDeliveryFeeRefundAmountCents(detailedOrder.refundability.deliveryFee.refundableAmountCents);
    setTipRefundAmountCents(detailedOrder.refundability.tip.refundableAmountCents);
  };

  const close = () => {
    if (refundMutation.isPending) {
      return;
    }
    onOpenChange(false);
  };

  const handleConfirmRefund = () => {
    if (!order || !detailedOrder || !canSubmit) {
      return;
    }

    refundMutation.mutate(
      {
        params: { id: order.id },
        body: {
          reason: refundReason.trim(),
          internalNotes: internalNotes.trim() || undefined,
          deliveryFee:
            deliveryFeeAmountCents > 0 ? { amountCents: deliveryFeeAmountCents } : undefined,
          tip: tipAmountCents > 0 ? { amountCents: tipAmountCents } : undefined,
          items: selectedItems.map((item) => ({
            orderItemId: item.item.id,
            quantity: item.quantity,
            restockQuantity: item.restockQuantity,
            amountCents: item.amountCents,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Refund request queued for order #${order.id}`);
          onSuccess?.();
          onOpenChange(false);
        },
        onError: () => {
          toast.error(`Refund request failed for order #${order.id}`);
        },
      },
    );
  };

  return (
    <AlertDialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
    >
      <AlertDialogContent className="max-h-[85vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:!max-w-5xl sm:p-6">
        {order && (
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">Refund Order #{order.id}</AlertDialogTitle>
            <AlertDialogDescription>
              Create a refund request for specific order items or fees. Total:{" "}
              {currencyFormatter.format(order.total)}
            </AlertDialogDescription>
          </AlertDialogHeader>
        )}

        {order && isLoading && (
          <div className="py-8 text-sm text-muted-foreground">Loading order details...</div>
        )}

        {detailedOrder && (
          <div className="space-y-4">
            {!canCreateRefund ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {detailedOrder.refundability.blockedReason
                  ? blockedReasonLabel[detailedOrder.refundability.blockedReason]
                  : "This order cannot be refunded right now."}
                {detailedOrder.refundability.pendingRefund ? (
                  <span>
                    {" "}
                    Pending refund #{detailedOrder.refundability.pendingRefund.id}:{" "}
                    {formatCents(detailedOrder.refundability.pendingRefund.totalAmountCents)}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="text-sm">
                <div className="font-medium">Refund remaining balance</div>
                <div className="text-muted-foreground">
                  Select all remaining refundable items, delivery fee, and tip.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={toggleAllRemaining}
                disabled={refundMutation.isPending || !canCreateRefund}
              >
                {allRemainingSelected ? "Clear selection" : "Select all remaining"}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>
                  Select remaining refundable item quantities and amounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {detailedOrder.items.map((item) => {
                    const refundableItem = refundableItemByOrderItemId.get(item.id);
                    if (!refundableItem) return null;
                    const refundState = itemRefunds[item.id];
                    const refundQuantity = refundState?.quantity ?? 0;
                    const restockQuantity = refundState?.restockQuantity ?? null;
                    const amountCents = Math.min(
                      refundState?.amountCents ?? 0,
                      refundableItem.refundableAmountCents,
                    );

                    return (
                      <div
                        key={item.id}
                        className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xs"
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={`mobile-check-${item.id}`}
                            checked={amountCents > 0}
                            onCheckedChange={(checked) =>
                              setRefundItemSelected(
                                item.id,
                                checked === true,
                                refundableItem.refundableQuantity,
                                refundableItem.refundableAmountCents,
                              )
                            }
                            disabled={
                              refundMutation.isPending ||
                              !canCreateRefund ||
                              refundableItem.refundableAmountCents <= 0
                            }
                            className="mt-1"
                          />
                          <label
                            htmlFor={`mobile-check-${item.id}`}
                            className="min-w-0 flex-1 cursor-pointer space-y-0.5"
                          >
                            <div className="text-sm leading-tight font-medium break-words">
                              {item.productName ?? item.sku}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {item.sku} • {currencyFormatter.format(item.unitPrice)} ea
                            </div>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded bg-muted/40 p-2 text-xs">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">
                              Refund Qty (Max {refundableItem.refundableQuantity})
                            </Label>
                            <Input
                              className="mt-1 h-8 w-full text-right text-xs"
                              type="number"
                              min={0}
                              step="1"
                              max={refundableItem.refundableQuantity}
                              value={refundQuantity}
                              onChange={(event) => {
                                const raw = Number(event.target.value);
                                setRefundQuantity(
                                  item.id,
                                  Number.isNaN(raw) ? 0 : raw,
                                  refundableItem.refundableQuantity,
                                  item.unitPrice,
                                  refundableItem.refundableAmountCents,
                                );
                              }}
                              disabled={
                                refundMutation.isPending ||
                                !canCreateRefund ||
                                refundableItem.refundableQuantity <= 0
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">
                              Refund amount
                            </Label>
                            <Input
                              className="mt-1 h-8 w-full text-right text-xs"
                              type="number"
                              min={0}
                              step="0.01"
                              max={refundableItem.refundableAmountCents / 100}
                              value={amountCents > 0 ? amountCents / 100 : ""}
                              onChange={(event) => {
                                const raw = Number(event.target.value);
                                setRefundItemAmount(
                                  item.id,
                                  Number.isNaN(raw) ? 0 : toCents(raw),
                                  refundableItem.refundableAmountCents,
                                );
                              }}
                              disabled={
                                refundMutation.isPending ||
                                !canCreateRefund ||
                                refundableItem.refundableAmountCents <= 0
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Restock qty</Label>
                            <Input
                              className="mt-1 h-8 w-full text-right text-xs"
                              type="number"
                              min={0}
                              step="1"
                              max={refundableItem.refundableQuantity}
                              value={restockQuantity ?? ""}
                              onChange={(event) => {
                                const rawValue = event.target.value;
                                const raw = Number(rawValue);
                                setRestockQuantity(
                                  item.id,
                                  rawValue === "" || Number.isNaN(raw) ? null : raw,
                                  refundableItem.refundableQuantity,
                                );
                              }}
                              disabled={
                                refundMutation.isPending ||
                                !canCreateRefund ||
                                amountCents <= 0 ||
                                refundableItem.refundableQuantity <= 0
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Refundable</Label>
                            <div className="mt-2 text-right font-medium">
                              {formatCents(refundableItem.refundableAmountCents)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2 text-xs font-medium">
                          <span className="text-muted-foreground">Item refund:</span>
                          <span>{formatCents(amountCents)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24 text-right">Original qty</TableHead>
                        <TableHead className="w-28 text-right">Refundable qty</TableHead>
                        <TableHead className="w-24 text-right">Refund qty</TableHead>
                        <TableHead className="w-24 text-right">Restock qty</TableHead>
                        <TableHead className="w-24 text-right">Unit price</TableHead>
                        <TableHead className="w-28 text-right">Refund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailedOrder.items.map((item) => {
                        const refundableItem = refundableItemByOrderItemId.get(item.id);
                        if (!refundableItem) return null;
                        const refundState = itemRefunds[item.id];
                        const refundQuantity = refundState?.quantity ?? 0;
                        const restockQuantity = refundState?.restockQuantity ?? null;
                        const amountCents = Math.min(
                          refundState?.amountCents ?? 0,
                          refundableItem.refundableAmountCents,
                        );
                        const amountDisabled =
                          refundMutation.isPending ||
                          !canCreateRefund ||
                          refundableItem.refundableAmountCents <= 0;
                        const quantityDisabled =
                          refundMutation.isPending ||
                          !canCreateRefund ||
                          refundableItem.refundableQuantity <= 0;
                        const restockDisabled =
                          amountDisabled ||
                          amountCents <= 0 ||
                          refundableItem.refundableQuantity <= 0;

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Checkbox
                                checked={amountCents > 0}
                                onCheckedChange={(checked) =>
                                  setRefundItemSelected(
                                    item.id,
                                    checked === true,
                                    refundableItem.refundableQuantity,
                                    refundableItem.refundableAmountCents,
                                  )
                                }
                                disabled={amountDisabled}
                              />
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <div className="font-medium">{item.productName ?? item.sku}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.sku}
                                {item.uncommittedQuantity > 0
                                  ? ` • ${item.uncommittedQuantity} uncommitted`
                                  : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {refundableItem.refundableQuantity}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                className="ml-auto w-16 text-right"
                                type="number"
                                min={0}
                                step="1"
                                max={refundableItem.refundableQuantity}
                                value={refundQuantity}
                                onChange={(event) => {
                                  const raw = Number(event.target.value);
                                  setRefundQuantity(
                                    item.id,
                                    Number.isNaN(raw) ? 0 : raw,
                                    refundableItem.refundableQuantity,
                                    item.unitPrice,
                                    refundableItem.refundableAmountCents,
                                  );
                                }}
                                disabled={quantityDisabled}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                className="ml-auto w-16 text-right"
                                type="number"
                                min={0}
                                step="1"
                                max={refundableItem.refundableQuantity}
                                value={restockQuantity ?? ""}
                                onChange={(event) => {
                                  const rawValue = event.target.value;
                                  const raw = Number(rawValue);
                                  setRestockQuantity(
                                    item.id,
                                    rawValue === "" || Number.isNaN(raw) ? null : raw,
                                    refundableItem.refundableQuantity,
                                  );
                                }}
                                disabled={restockDisabled}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {currencyFormatter.format(item.unitPrice)}
                            </TableCell>
                            <TableCell>
                              <Input
                                className="ml-auto w-28 text-right"
                                type="number"
                                min={0}
                                step="0.01"
                                max={refundableItem.refundableAmountCents / 100}
                                value={amountCents > 0 ? amountCents / 100 : ""}
                                onChange={(event) => {
                                  const raw = Number(event.target.value);
                                  setRefundItemAmount(
                                    item.id,
                                    Number.isNaN(raw) ? 0 : toCents(raw),
                                    refundableItem.refundableAmountCents,
                                  );
                                }}
                                disabled={amountDisabled}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fees</CardTitle>
                <CardDescription>Refund remaining delivery fee or tip amounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Fee</TableHead>
                      <TableHead className="w-28 text-right">Refunded</TableHead>
                      <TableHead className="w-28 text-right">Refundable</TableHead>
                      <TableHead className="w-28 text-right">Refund</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <FeeRow
                      label={
                        detailedOrder.pricing.tipPercentage !== null
                          ? `Tip (${detailedOrder.pricing.tipPercentage}%)`
                          : "Tip"
                      }
                      amountCents={tipAmountCents}
                      disabled={
                        refundMutation.isPending ||
                        !canCreateRefund ||
                        detailedOrder.refundability.tip.refundableAmountCents <= 0
                      }
                      refundedAmountCents={detailedOrder.refundability.tip.refundedAmountCents}
                      refundableAmountCents={detailedOrder.refundability.tip.refundableAmountCents}
                      onAmountCentsChange={setTipRefundAmountCents}
                    />
                    <FeeRow
                      label="Delivery fee"
                      amountCents={deliveryFeeAmountCents}
                      disabled={
                        refundMutation.isPending ||
                        !canCreateRefund ||
                        detailedOrder.refundability.deliveryFee.refundableAmountCents <= 0
                      }
                      refundedAmountCents={
                        detailedOrder.refundability.deliveryFee.refundedAmountCents
                      }
                      refundableAmountCents={
                        detailedOrder.refundability.deliveryFee.refundableAmountCents
                      }
                      onAmountCentsChange={setDeliveryFeeRefundAmountCents}
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Refund amount</CardTitle>
                <CardDescription>Total derived from selected refund targets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Items</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(itemsAmountCents)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Delivery fee</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(deliveryFeeAmountCents)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Tip</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(tipAmountCents)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">
                        Total refund
                        {!hasAnySelection ? (
                          <p className="text-xs text-destructive">
                            Select at least one item or fee to refund.
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCents(totalAmountCents)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confirmation</CardTitle>
                <CardDescription>Confirm the refund request</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <Label htmlFor="refund-reason">Refund reason</Label>
                  <p className="text-xs text-muted-foreground">
                    Customer ordered in {customerLanguageLabel(detailedOrder.preferredLocale)}.
                    Write the customer-visible reason in that language.
                  </p>
                  <Textarea
                    id="refund-reason"
                    placeholder="Customer-visible reason"
                    value={refundReason}
                    onChange={(event) => setRefundReason(event.target.value)}
                    disabled={refundMutation.isPending || !canCreateRefund}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refund-internal-notes">Internal notes (optional)</Label>
                  <Textarea
                    id="refund-internal-notes"
                    placeholder="Visible to staff only"
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    disabled={refundMutation.isPending || !canCreateRefund}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="refund-confirm">Type REFUND to confirm</Label>
                  <Input
                    id="refund-confirm"
                    placeholder="REFUND"
                    value={refundConfirmText}
                    onChange={(event) => setRefundConfirmText(event.target.value)}
                    disabled={refundMutation.isPending || !canCreateRefund}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {detailedOrder && (
          <AlertDialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={close} disabled={refundMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRefund} disabled={!canSubmit}>
              {refundMutation.isPending ? "Queueing..." : "Queue refund request"}
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FeeRow({
  label,
  amountCents,
  disabled,
  refundedAmountCents,
  refundableAmountCents,
  onAmountCentsChange,
}: {
  label: string;
  amountCents: number;
  disabled: boolean;
  refundedAmountCents: number;
  refundableAmountCents: number;
  onAmountCentsChange: (amountCents: number) => void;
}) {
  const checked = amountCents > 0;

  return (
    <TableRow className={refundableAmountCents === 0 ? "opacity-40" : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(nextChecked) =>
            onAmountCentsChange(nextChecked === true ? refundableAmountCents : 0)
          }
          disabled={disabled}
        />
      </TableCell>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{formatCents(refundedAmountCents)}</TableCell>
      <TableCell className="text-right">{formatCents(refundableAmountCents)}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Input
            className="w-28 text-right"
            type="number"
            min={0}
            step="0.01"
            max={refundableAmountCents / 100}
            value={amountCents > 0 ? amountCents / 100 : ""}
            onChange={(event) => {
              const rawAmount = Number(event.target.value);
              onAmountCentsChange(
                Number.isNaN(rawAmount) ? 0 : clampCents(toCents(rawAmount), refundableAmountCents),
              );
            }}
            disabled={disabled}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

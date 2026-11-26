import { RouteError } from "@rest-rpc/server";
import * as Sentry from "@sentry/node";
import z from "zod";

import {
  buildOrderPricing,
  findRelevantOrderById,
  findRelevantOrders,
  type RelevantOrder,
} from "#src/features/customer-api/orders/relevantOrders.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { generateOrderInvoicePdf } from "#src/utils/pdf/generateOrderInvoicePdf.ts";
import { generateRefundReceiptPdf } from "#src/utils/pdf/generateRefundReceiptPdf.ts";

const orderRoute = dashboardRoute.meta({ access: "ADMIN" });
const orderTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const OrderItemRefundSchema = z.object({
  orderItemId: z.number().int().positive(),
  quantity: z.number().int().nonnegative(),
  restockQuantity: z.number().int().nonnegative().nullish(),
  amountCents: z.number().int().positive(),
});

const REFUNDABLE_STATUSES = ["PAID", "DELIVERED"] as const;

const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + amount, 0);

const buildAmountSummary = ({
  originalAmountCents,
  refundedAmountCents,
}: {
  originalAmountCents: number;
  refundedAmountCents: number;
}) => ({
  originalAmountCents,
  refundedAmountCents,
  refundableAmountCents: Math.max(0, originalAmountCents - refundedAmountCents),
});

const pendingRefundStatuses = ["PENDING", "PROCESSING"] as const;

const buildOrderRefundSummary = (order: RelevantOrder) => {
  const succeededRefunds = order.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const pendingRefunds = order.refunds.filter((refund) =>
    pendingRefundStatuses.includes(refund.status as (typeof pendingRefundStatuses)[number]),
  );
  const originalAmountCents = order.charged_total_cents;
  const refundedAmountCents = sum(succeededRefunds.map((refund) => refund.total_amount_cents));
  const pendingAmountCents = sum(pendingRefunds.map((refund) => refund.total_amount_cents));
  const requiresManualReview = order.refunds.some(
    (refund) => refund.status === "REQUIRES_MANUAL_REVIEW",
  );
  const isFullyRefunded = refundedAmountCents >= originalAmountCents;
  const hasPendingFullRefund =
    pendingAmountCents > 0 && refundedAmountCents + pendingAmountCents >= originalAmountCents;
  const status:
    | "REFUND_REQUIRES_MANUAL_REVIEW"
    | "REFUND_PENDING"
    | "FULLY_REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "NONE" = requiresManualReview
    ? "REFUND_REQUIRES_MANUAL_REVIEW"
    : pendingAmountCents > 0
      ? "REFUND_PENDING"
      : isFullyRefunded
        ? "FULLY_REFUNDED"
        : refundedAmountCents > 0
          ? "PARTIALLY_REFUNDED"
          : "NONE";

  return {
    status,
    succeededCount: succeededRefunds.length,
    pendingCount: pendingRefunds.length,
    refundedAmountCents,
    pendingAmountCents,
    refundableAmountCents: Math.max(
      0,
      originalAmountCents - refundedAmountCents - pendingAmountCents,
    ),
    isFullyRefunded,
    hasPendingFullRefund,
  };
};

const buildOrderRefundability = (order: RelevantOrder) => {
  const succeededRefunds = order.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const pendingRefund = order.refunds.find((refund) =>
    pendingRefundStatuses.includes(refund.status as (typeof pendingRefundStatuses)[number]),
  );

  const refundedQuantityByOrderItemId = new Map<number, number>();
  const refundedAmountCentsByOrderItemId = new Map<number, number>();

  for (const refund of succeededRefunds) {
    for (const refundItem of refund.refund_items) {
      if (refundItem.quantity != null) {
        refundedQuantityByOrderItemId.set(
          refundItem.order_item_id,
          (refundedQuantityByOrderItemId.get(refundItem.order_item_id) ?? 0) + refundItem.quantity,
        );
      }

      refundedAmountCentsByOrderItemId.set(
        refundItem.order_item_id,
        (refundedAmountCentsByOrderItemId.get(refundItem.order_item_id) ?? 0) +
          refundItem.amount_cents,
      );
    }
  }

  const items = order.orderItems.map((item) => {
    const originalAmountCents = item.unit_sales_price_cents * item.quantity;
    const refundedAmountCents = refundedAmountCentsByOrderItemId.get(item.id) ?? 0;
    const refundedQuantity = refundedQuantityByOrderItemId.get(item.id) ?? 0;

    return {
      orderItemId: item.id,
      ...buildAmountSummary({
        originalAmountCents,
        refundedAmountCents,
      }),
      refundedQuantity,
      refundableQuantity: Math.max(0, item.quantity - refundedQuantity),
    };
  });

  const hasRefundableTarget = items.some(
    (item) => item.refundableQuantity > 0 && item.refundableAmountCents > 0,
  );

  const blockedReason:
    | "REFUND_ALREADY_PENDING"
    | "ORDER_NOT_REFUNDABLE"
    | "MISSING_PAYMENT"
    | "NOTHING_REFUNDABLE"
    | undefined = pendingRefund
    ? "REFUND_ALREADY_PENDING"
    : !REFUNDABLE_STATUSES.includes(order.status as (typeof REFUNDABLE_STATUSES)[number])
      ? "ORDER_NOT_REFUNDABLE"
      : !order.payment_id
        ? "MISSING_PAYMENT"
        : !hasRefundableTarget
          ? "NOTHING_REFUNDABLE"
          : undefined;

  return {
    canCreateRefund: blockedReason == null,
    blockedReason,
    pendingRefund: pendingRefund
      ? {
          id: pendingRefund.id,
          totalAmountCents: pendingRefund.total_amount_cents,
          createdAt: pendingRefund.created_at,
        }
      : undefined,
    items,
  };
};

export const ordersRoutes = {
  getAll: orderRoute
    .get("/orders")
    .query(
      z.object({
        customerId: z.coerce.number<number>().int().positive().optional(),
      }),
    )
    .handler(async ({ query, context }) => {
      const orders = await findRelevantOrders(context.db, {
        customerId: query.customerId,
      });

      return toResponse(
        orders.map((order) => {
          const orderDetails = order.order_details;

          return {
            id: order.id,
            totalCents: order.charged_total_cents,
            status: order.status,
            created_at: order.created_at,
            customer_id: order.customer_id,
            contact: {
              name: orderDetails.customer.name,
              email: orderDetails.customer.email,
              phone: orderDetails.customer.phone,
            },
            delivery: {
              addressLabel: orderDetails.delivery.addressLabel,
              instructions: orderDetails.delivery.instructions,
            },
            refundSummary: buildOrderRefundSummary(order),
            refundReceipts: order.refundReceipts,
          };
        }),
        context.locale,
      );
    }),

  getById: orderRoute
    .get("/orders/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const order = await findRelevantOrderById(context.db, {
        orderId: params.id,
      });

      const orderDetails = order.order_details;
      const refundability = buildOrderRefundability(order);
      const refundSummary = buildOrderRefundSummary(order);
      const refundableItemById = new Map(
        refundability.items.map((item) => [item.orderItemId, item]),
      );

      const strippedOrder = {
        id: order.id,
        status: order.status,
        created_at: order.created_at,
        customer_id: order.customer_id,
        preferredLocale: order.preferred_locale,
      };
      const pricing = buildOrderPricing(order);

      return toResponse(
        {
          ...strippedOrder,
          customer: {
            name: orderDetails.customer.name,
            email: orderDetails.customer.email,
            phone: orderDetails.customer.phone,
          },
          delivery: {
            addressLabel: orderDetails.delivery.addressLabel,
            instructions: orderDetails.delivery.instructions,
          },
          items: order.orderItems.map((item) => ({
            id: item.id,
            sku: item.sku,
            quantity: item.quantity,
            uncommittedQuantity: item.uncommitted_quantity,
            refundedQuantity: refundableItemById.get(item.id)?.refundedQuantity ?? 0,
            unitPriceCents: item.unit_sales_price_cents,
            productId: item.product_id,
            productName: item.name,
            productImageUrl: item.product?.images[0]?.image.storage_key
              ? context.storage.getPublicUrl(item.product.images[0].image.storage_key)
              : undefined,
            vendorId: item.vendor_id,
            vendorName: item.vendor_name,
          })),
          pricing,
          refundSummary,
          refundReceipts: order.refundReceipts,
          refundability,
        },
        context.locale,
      );
    }),

  downloadInvoice: orderRoute
    .get("/orders/:id/invoice")
    .params(idParams)
    .handler(async ({ params, context, respond }) => {
      const pdf = await generateOrderInvoicePdf(
        { db: context.db, config: context.config },
        {
          access: "admin",
          orderId: params.id,
          locale: context.locale,
        },
      );

      return respond(new Blob([new Uint8Array(pdf.body)], { type: pdf.contentType }), {
        headers: {
          "content-type": pdf.contentType,
          "content-disposition": `attachment; filename="${pdf.filename.replaceAll('"', '\\"')}"`,
        },
      });
    }),

  downloadRefundReceipt: orderRoute
    .get("/orders/:id/refunds/:refundId/receipt")
    .params(
      z.object({
        id: z.coerce.number<number>().int().positive(),
        refundId: z.coerce.number<number>().int().positive(),
      }),
    )
    .handler(async ({ params, context, respond }) => {
      const pdf = await generateRefundReceiptPdf(
        { db: context.db, config: context.config },
        {
          access: "admin",
          orderId: params.id,
          refundId: params.refundId,
          locale: context.locale,
        },
      );

      return respond(new Blob([new Uint8Array(pdf.body)], { type: pdf.contentType }), {
        headers: {
          "content-type": pdf.contentType,
          "content-disposition": `attachment; filename="${pdf.filename.replaceAll('"', '\\"')}"`,
        },
      });
    }),

  refund: orderTxRoute
    .post("/orders/:id/refund")
    .params(idParams)
    .body(
      z.object({
        reason: z.string().trim().min(1).max(500),
        internalNotes: z.string().trim().min(1).max(1000).optional(),
        items: z.array(OrderItemRefundSchema),
      }),
    )
    .handler(async ({ params, body, context }) => {
      const { reason, internalNotes, items } = body;
      const id = params.id;

      Sentry.getCurrentScope().setContext("order", { orderId: id });

      const order = await findRelevantOrderById(context.db, {
        orderId: id,
      });
      const refundability = buildOrderRefundability(order);

      if (!refundability.canCreateRefund) {
        throw new RouteError("BAD_REQUEST", {
          status: 400,
          message: refundability.blockedReason ?? "ORDER_NOT_REFUNDABLE",
        });
      }

      const refundableItemById = new Map(
        refundability.items.map((item) => [item.orderItemId, item]),
      );
      const seenOrderItemIds = new Set<number>();

      for (const item of items) {
        if (seenOrderItemIds.has(item.orderItemId)) {
          throw new RouteError("BAD_REQUEST", {
            status: 400,
            message: "DUPLICATE_REFUND_ITEM",
          });
        }
        seenOrderItemIds.add(item.orderItemId);

        const refundableItem = refundableItemById.get(item.orderItemId);
        if (!refundableItem) {
          throw new RouteError("BAD_REQUEST", {
            status: 400,
            message: "INVALID_REFUND_TARGET",
          });
        }
        if (item.quantity > refundableItem.refundableQuantity) {
          throw new RouteError("BAD_REQUEST", {
            status: 400,
            message: "INVALID_REFUND_QUANTITY",
          });
        }
        if (item.amountCents > refundableItem.refundableAmountCents) {
          throw new RouteError("BAD_REQUEST", {
            status: 400,
            message: "INVALID_REFUND_AMOUNT",
          });
        }
        if (
          item.restockQuantity != null &&
          item.restockQuantity > refundableItem.refundableQuantity
        ) {
          throw new RouteError("BAD_REQUEST", {
            status: 400,
            message: "INVALID_RESTOCK_QUANTITY",
          });
        }
      }

      const totalAmountCents = items.reduce((total, item) => total + item.amountCents, 0);

      if (totalAmountCents <= 0) {
        throw new RouteError("BAD_REQUEST", {
          status: 400,
          message: "NOTHING_TO_REFUND",
        });
      }

      const refund = await context.db.refund.create({
        data: {
          order_id: id,
          status: "PENDING",
          total_amount_cents: totalAmountCents,
          reason,
          internal_notes: internalNotes,
          refund_items: {
            create: items.map((item) => ({
              order_item_id: item.orderItemId,
              quantity: item.quantity,
              restock_quantity: item.restockQuantity,
              amount_cents: item.amountCents,
            })),
          },
        },
        select: { id: true },
      });

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "OTHER",
        entity: "order",
        entityId: id,
        details: {
          operation: "order.refund.intent.create",
          orderId: id,
          refundId: refund.id,
          reason,
          internalNotes,
          totalAmountCents,
          items,
        },
      });

      await context.enqueueJob({
        type: "processRefund",
        payload: { refundId: refund.id },
        maxAttempts: 1,
      });

      const result = {
        refundId: refund.id,
        status: "PENDING" as const,
      };

      return toResponse(result, context.locale);
    }),
};

import { RouteError } from "@rest-rpc/server";
import z from "zod";

import { refundItemTable, refundTable } from "#src/db/schema.ts";
import {
  buildOrderPricing,
  findRelevantOrderById,
  findRelevantOrders,
  type RelevantOrder,
} from "#src/features/customer-api/orders/relevantOrders.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
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

const REFUNDABLE_STATUSES = ["PAID", "SHIPPED"] as const;

const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + amount, 0);

const pendingRefundStatuses = ["PENDING", "PROCESSING"] as const;

const buildOrderRefundSummary = (order: RelevantOrder) => {
  const succeededRefunds = order.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const pendingRefunds = order.refunds.filter((refund) =>
    pendingRefundStatuses.includes(refund.status as (typeof pendingRefundStatuses)[number]),
  );
  const originalAmountCents = order.chargedTotalCents;
  const refundedAmountCents = sum(succeededRefunds.map((refund) => refund.totalAmountCents));
  const pendingAmountCents = sum(pendingRefunds.map((refund) => refund.totalAmountCents));
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
    for (const refundItem of refund.refundItems) {
      if (refundItem.quantity != null) {
        refundedQuantityByOrderItemId.set(
          refundItem.orderItemId,
          (refundedQuantityByOrderItemId.get(refundItem.orderItemId) ?? 0) + refundItem.quantity,
        );
      }

      refundedAmountCentsByOrderItemId.set(
        refundItem.orderItemId,
        (refundedAmountCentsByOrderItemId.get(refundItem.orderItemId) ?? 0) +
          refundItem.amountCents,
      );
    }
  }

  const items = order.orderItems.map((item) => {
    const originalAmountCents = item.unitSalesPriceCents * item.quantity;
    const refundedAmountCents = refundedAmountCentsByOrderItemId.get(item.id) ?? 0;
    const refundedQuantity = refundedQuantityByOrderItemId.get(item.id) ?? 0;

    return {
      orderItemId: item.id,
      originalAmountCents,
      refundedAmountCents,
      refundableAmountCents: Math.max(0, originalAmountCents - refundedAmountCents),
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
      : !order.paymentId
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
          totalAmountCents: pendingRefund.totalAmountCents,
          createdAt: pendingRefund.createdAt,
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

      return orders.map((order) => {
        const orderDetails = order.orderDetails;

        return {
          id: order.id,
          totalCents: order.chargedTotalCents,
          status: order.status,
          createdAt: order.createdAt,
          customerId: order.customerId,
          contact: {
            name: orderDetails.customer.name,
            email: orderDetails.customer.email,
            phone: orderDetails.customer.phone,
          },
          shippingAddress: orderDetails.shippingAddress,
          refundSummary: buildOrderRefundSummary(order),
          refundReceipts: order.refundReceipts,
        };
      });
    }),

  getById: orderRoute
    .get("/orders/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const order = await findRelevantOrderById(context.db, {
        orderId: params.id,
      });

      const orderDetails = order.orderDetails;
      const refundability = buildOrderRefundability(order);
      const refundSummary = buildOrderRefundSummary(order);
      const refundableItemById = new Map(
        refundability.items.map((item) => [item.orderItemId, item]),
      );

      const strippedOrder = {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        customerId: order.customerId,
        preferredLocale: order.preferredLocale,
      };
      const pricing = buildOrderPricing(order);

      return {
        ...strippedOrder,
        customer: {
          name: orderDetails.customer.name,
          email: orderDetails.customer.email,
          phone: orderDetails.customer.phone,
        },
        shippingAddress: orderDetails.shippingAddress,
        items: order.orderItems.map((item) => ({
          id: item.id,
          sku: item.sku,
          quantity: item.quantity,
          uncommittedQuantity: item.uncommittedQuantity,
          refundedQuantity: refundableItemById.get(item.id)?.refundedQuantity ?? 0,
          unitPriceCents: item.unitSalesPriceCents,
          productId: item.productId,
          productName: item.name,
          productImageUrl: item.product?.images[0]?.image.storageKey
            ? context.storage.getPublicUrl(item.product.images[0].image.storageKey)
            : undefined,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
        })),
        pricing,
        refundSummary,
        refundReceipts: order.refundReceipts,
        refundability,
      };
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

      const [refund] = await context.db
        .insert(refundTable)
        .values({
          orderId: id,
          status: "PENDING",
          totalAmountCents,
          reason,
          internalNotes,
        })
        .returning({ id: refundTable.id });
      await context.db.insert(refundItemTable).values(
        items.map((item) => ({
          refundId: refund.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          restockQuantity: item.restockQuantity,
          amountCents: item.amountCents,
        })),
      );

      await context.enqueueJob({
        type: "processRefund",
        payload: { refundId: refund.id },
        options: { retryLimit: 0 },
      });

      const result = {
        refundId: refund.id,
        status: "PENDING" as const,
      };

      return result;
    }),
};

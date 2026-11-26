import { RouteError } from "@rest-rpc/server";

import type { Db } from "#src/db/client.ts";
import { FIRST_LINKED_IMAGE_SELECT } from "#src/utils/imageUrl.ts";
import { type RelevantOrderStatus, relevantOrderStatuses } from "#src/utils/orderStatus.ts";

const relevantOrderWith = {
  orderItems: {
    orderBy: {
      id: "asc",
    },
    with: {
      product: {
        columns: {
          id: true,
          name: true,
        },
        with: { images: FIRST_LINKED_IMAGE_SELECT },
      },
      vendor: {
        columns: {
          id: true,
          name: true,
        },
        with: { images: FIRST_LINKED_IMAGE_SELECT },
      },
    },
  },
  reviews: {
    columns: {
      id: true,
    },
    limit: 1,
  },
  refunds: {
    columns: {
      id: true,
      status: true,
      totalAmountCents: true,
      createdAt: true,
    },
    with: {
      refundItems: {
        columns: {
          orderItemId: true,
          quantity: true,
          amountCents: true,
        },
      },
    },
  },
} as const;

const findRelevantOrderRows = (
  db: Db,
  where: { customerId?: number; orderId?: number; token?: string },
) =>
  db.query.order.findMany({
    where: {
      ...(where.orderId != null && { id: where.orderId }),
      ...(where.customerId != null && { customerId: where.customerId }),
      ...(where.token && { claimToken: where.token }),
      status: { in: [...relevantOrderStatuses] },
    },
    orderBy: { createdAt: "desc" },
    with: relevantOrderWith,
  });

type RelevantOrderRow = Awaited<ReturnType<typeof findRelevantOrderRows>>[number];

const parseRelevantOrder = (order: RelevantOrderRow) => {
  const succeededRefunds = order.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const refundedQuantityByOrderItemId = new Map<number, number>();

  for (const refund of succeededRefunds) {
    for (const refundItem of refund.refundItems) {
      if (refundItem.quantity == null) {
        continue;
      }

      refundedQuantityByOrderItemId.set(
        refundItem.orderItemId,
        (refundedQuantityByOrderItemId.get(refundItem.orderItemId) ?? 0) + refundItem.quantity,
      );
    }
  }

  const refundedCents = succeededRefunds.reduce(
    (total, refund) => total + refund.totalAmountCents,
    0,
  );
  const refundReceipts = succeededRefunds.map((refund) => ({
    refundId: refund.id,
    number: `RR-${refund.id}`,
    createdAt: refund.createdAt,
    totalCents: refund.totalAmountCents,
  }));

  return {
    ...order,
    status: order.status as RelevantOrderStatus,
    refundSummary: {
      refundedCents: refundedCents > 0 ? refundedCents : null,
      refundedQuantityByOrderItemId,
    },
    refundReceipts,
    orderItems: order.orderItems,
    hasSubmittedReview: (order.reviews?.length ?? 0) > 0,
  };
};

export type RelevantOrder = ReturnType<typeof parseRelevantOrder>;

export const buildOrderPricing = (order: RelevantOrder) => ({
  itemsSubtotalCents: order.itemsSubtotalCents,
  itemsDiscountCents: order.itemsDiscountCents > 0 ? order.itemsDiscountCents : null,
  discountedItemsSubtotalCents:
    order.itemsDiscountCents > 0 ? order.itemsSubtotalCents - order.itemsDiscountCents : null,
  chargedTotalCents: order.chargedTotalCents,
  vatRate: order.vatRate,
  includedVatCents: order.includedVatCents,
  refundedCents: order.refundSummary.refundedCents,
});

export const findRelevantOrders = async (db: Db, { customerId }: { customerId?: number } = {}) =>
  (await findRelevantOrderRows(db, { customerId })).map(parseRelevantOrder);

export const findRelevantOrderById = async (
  db: Db,
  {
    orderId,
    customerId,
    token,
  }: {
    orderId: number;
    customerId?: number;
    token?: string;
  },
) => {
  const [order] = await findRelevantOrderRows(db, { orderId, customerId, token });

  if (!order) throw new RouteError("NOT_FOUND", { status: 404 });
  return parseRelevantOrder(order);
};

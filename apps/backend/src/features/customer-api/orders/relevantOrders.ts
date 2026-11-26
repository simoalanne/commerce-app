import { RouteError } from "@rest-rpc/server";

import type { Db } from "#src/db/client.ts";
import { FIRST_LINKED_IMAGE_SELECT } from "#src/utils/imageUrl.ts";
import { type RelevantOrderStatus, relevantOrderStatuses } from "#src/utils/orderStatus.ts";

const relevantOrderWith = {
  order_items: {
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
      total_amount_cents: true,
      created_at: true,
    },
    with: {
      refund_items: {
        columns: {
          order_item_id: true,
          quantity: true,
          amount_cents: true,
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
      ...(where.customerId != null && { customer_id: where.customerId }),
      ...(where.token && { claim_token: where.token }),
      status: { in: [...relevantOrderStatuses] },
    },
    orderBy: { created_at: "desc" },
    with: relevantOrderWith,
  });

type RelevantOrderRow = Awaited<ReturnType<typeof findRelevantOrderRows>>[number];

const parseRelevantOrder = (order: RelevantOrderRow) => {
  const succeededRefunds = order.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const refundedQuantityByOrderItemId = new Map<number, number>();

  for (const refund of succeededRefunds) {
    for (const refundItem of refund.refund_items) {
      if (refundItem.quantity == null) {
        continue;
      }

      refundedQuantityByOrderItemId.set(
        refundItem.order_item_id,
        (refundedQuantityByOrderItemId.get(refundItem.order_item_id) ?? 0) + refundItem.quantity,
      );
    }
  }

  const refundedCents = succeededRefunds.reduce(
    (total, refund) => total + refund.total_amount_cents,
    0,
  );
  const refundReceipts = succeededRefunds.map((refund) => ({
    refundId: refund.id,
    number: `RR-${refund.id}`,
    createdAt: refund.created_at,
    totalCents: refund.total_amount_cents,
  }));

  return {
    ...order,
    status: order.status as RelevantOrderStatus,
    refundSummary: {
      refundedCents: refundedCents > 0 ? refundedCents : null,
      refundedQuantityByOrderItemId,
    },
    refundReceipts,
    orderItems: order.order_items,
    hasSubmittedReview: (order.reviews?.length ?? 0) > 0,
  };
};

export type RelevantOrder = ReturnType<typeof parseRelevantOrder>;

export const buildOrderPricing = (order: RelevantOrder) => ({
  itemsSubtotalCents: order.items_subtotal_cents,
  itemsDiscountCents: order.items_discount_cents > 0 ? order.items_discount_cents : null,
  discountedItemsSubtotalCents:
    order.items_discount_cents > 0 ? order.items_subtotal_cents - order.items_discount_cents : null,
  chargedTotalCents: order.charged_total_cents,
  vatRate: order.vat_rate,
  includedVatCents: order.included_vat_cents,
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

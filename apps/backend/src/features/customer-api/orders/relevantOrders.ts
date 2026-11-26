import type { Prisma } from "@prisma/client";

import { FIRST_LINKED_IMAGE_SELECT } from "#src/utils/imageUrl.ts";
import { type RelevantOrderStatus, relevantOrderStatuses } from "#src/utils/orderStatus.ts";

const relevantOrderInclude = {
  order_items: {
    orderBy: {
      id: "asc",
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: FIRST_LINKED_IMAGE_SELECT,
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
          images: FIRST_LINKED_IMAGE_SELECT,
        },
      },
    },
  },
  reviews: {
    select: {
      id: true,
    },
    take: 1,
  },
  refunds: {
    select: {
      id: true,
      status: true,
      total_amount_cents: true,
      created_at: true,
      refund_items: {
        select: {
          order_item_id: true,
          quantity: true,
          amount_cents: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type RelevantOrderRow = Prisma.OrderGetPayload<{
  include: typeof relevantOrderInclude;
}>;

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
    order_details: order.order_details as PrismaJson.OrderDetails,
    invoice_details: order.invoice_details as PrismaJson.OrderInvoiceDetails,
    orderItems: order.order_items.map((item) => ({
      ...item,
      product: item.product
        ? {
            ...item.product,
            name: item.product.name as PrismaJson.LocalizedString,
          }
        : null,
    })),
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

export const findRelevantOrders = async (
  db: Prisma.TransactionClient,
  { customerId }: { customerId?: number } = {},
) => {
  const orders = await db.order.findMany({
    where: {
      ...(customerId != null ? { customer_id: customerId } : {}),
      status: { in: [...relevantOrderStatuses] },
    },
    orderBy: { created_at: "desc" },
    include: relevantOrderInclude,
  });

  return orders.map(parseRelevantOrder);
};

export const findRelevantOrderById = async (
  db: Prisma.TransactionClient,
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
  const order = await db.order.findFirstOrThrow({
    where: {
      id: orderId,
      ...(customerId != null ? { customer_id: customerId } : {}),
      ...(token ? { claim_token: token } : {}),
      status: { in: [...relevantOrderStatuses] },
    },
    include: relevantOrderInclude,
  });

  return parseRelevantOrder(order);
};

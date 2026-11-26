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
      total_amount: true,
      delivery_fee: true,
      tip_amount: true,
      created_at: true,
      refund_items: {
        select: {
          order_item_id: true,
          quantity: true,
          amount: true,
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

  const refundedDeliveryFee = succeededRefunds.reduce(
    (total, refund) => total + (refund.delivery_fee?.toNumber() ?? 0),
    0,
  );
  const refundedTipAmount = succeededRefunds.reduce(
    (total, refund) => total + (refund.tip_amount?.toNumber() ?? 0),
    0,
  );
  const refundedAmount = succeededRefunds.reduce(
    (total, refund) => total + refund.total_amount.toNumber(),
    0,
  );
  const refundReceipts = succeededRefunds.map((refund) => ({
    refundId: refund.id,
    number: `RR-${refund.id}`,
    createdAt: refund.created_at,
    total: refund.total_amount.toNumber(),
  }));

  return {
    ...order,
    status: order.status as RelevantOrderStatus,
    items_subtotal: order.items_subtotal.toNumber(),
    items_discount_amount: order.items_discount_amount.toNumber(),
    delivery_fee: order.delivery_fee.toNumber(),
    delivery_discount_amount: order.delivery_discount_amount.toNumber(),
    tip_percentage: order.tip_percentage.toNumber(),
    tip_amount: order.tip_amount.toNumber(),
    charged_total: order.charged_total.toNumber(),
    vat_rate: order.vat_rate.toNumber(),
    included_vat_amount: order.included_vat_amount.toNumber(),
    refundSummary: {
      refundedAmount: refundedAmount > 0 ? refundedAmount : null,
      refundedDeliveryFee: refundedDeliveryFee > 0 ? refundedDeliveryFee : null,
      refundedTipAmount: refundedTipAmount > 0 ? refundedTipAmount : null,
      refundedQuantityByOrderItemId,
    },
    refundReceipts,
    order_details: order.order_details as PrismaJson.OrderDetails,
    invoice_details: order.invoice_details as PrismaJson.OrderInvoiceDetails,
    orderItems: order.order_items.map((item) => ({
      ...item,
      unit_cost_price: item.unit_cost_price.toNumber(),
      unit_sales_price: item.unit_sales_price.toNumber(),
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
  itemsSubtotal: order.items_subtotal,
  itemsDiscountAmount: order.items_discount_amount > 0 ? order.items_discount_amount : null,
  discountedItemsSubtotal:
    order.items_discount_amount > 0 ? order.items_subtotal - order.items_discount_amount : null,
  deliveryFee: order.delivery_fee,
  deliveryDiscountAmount:
    order.delivery_discount_amount > 0 ? order.delivery_discount_amount : null,
  discountedDeliveryFee:
    order.delivery_discount_amount > 0 ? order.delivery_fee - order.delivery_discount_amount : null,
  tipPercentage: order.tip_percentage > 0 ? order.tip_percentage : null,
  tipAmount: order.tip_amount > 0 ? order.tip_amount : null,
  chargedTotal: order.charged_total,
  vatRate: order.vat_rate,
  includedVatAmount: order.included_vat_amount,
  refundedAmount: order.refundSummary.refundedAmount,
  refundedDeliveryFee: order.refundSummary.refundedDeliveryFee,
  refundedTipAmount: order.refundSummary.refundedTipAmount,
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

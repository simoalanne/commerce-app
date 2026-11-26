import type { Prisma } from "@prisma/client";

import { restockProductStock } from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import type { TransactionalEnqueueJob } from "#src/jobs/queue.ts";
import { buildProductStockInvalidationTags } from "#src/utils/productStockInvalidationTags.ts";

export const enqueueProductStockInvalidationJobs = async ({
  productIds,
  enqueueJob,
}: {
  productIds: number[];
  enqueueJob: TransactionalEnqueueJob;
}) => {
  await enqueueJob({
    type: "invalidateStorefrontCache",
    payload: { tags: buildProductStockInvalidationTags(productIds) },
  });
  await enqueueJob({
    type: "invalidateSearchIndex",
    payload: { productIds },
  });
};

export const enqueueOrderRefundSucceededSideEffectJobs = async ({
  refundId,
  enqueueJob,
  transaction,
}: {
  refundId: number;
  enqueueJob: TransactionalEnqueueJob;
  transaction: Prisma.TransactionClient;
}) => {
  const restockItems = await transaction.refundItem.findMany({
    where: {
      refund_id: refundId,
      restock_quantity: { gt: 0 },
    },
    select: {
      restock_quantity: true,
      order_item: {
        select: {
          product_id: true,
        },
      },
    },
  });

  await restockProductStock({
    items: restockItems.map((item) => ({
      product_id: item.order_item.product_id,
      quantity: item.restock_quantity,
    })),
    transaction,
  });

  const restockedProductIds = restockItems.flatMap((item) =>
    item.order_item.product_id == null ? [] : [item.order_item.product_id],
  );
  if (restockedProductIds.length) {
    await enqueueProductStockInvalidationJobs({
      productIds: restockedProductIds,
      enqueueJob,
    });
  }

  await enqueueJob({
    type: "sendOrderRefundedEmail",
    payload: { refundId },
  });

  const subscribers = await transaction.webhookSubscription.findMany({
    where: { event: "order.refunded" },
    select: { url: true },
  });

  for (const subscriber of subscribers) {
    await enqueueJob({
      type: "deliverOrderRefundedWebhookEvent",
      payload: { refundId, url: subscriber.url },
    });
  }
};

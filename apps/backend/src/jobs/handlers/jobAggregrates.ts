import type { Db } from "#src/db/client.ts";
import { restockProductStock } from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import type { EnqueueJob } from "#src/jobs/queue.ts";
import { buildProductStockInvalidationTags } from "#src/utils/productStockInvalidationTags.ts";

export const enqueueProductStockInvalidationJobs = async ({
  productIds,
  enqueueJob,
}: {
  productIds: number[];
  enqueueJob: EnqueueJob;
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
  enqueueJob: EnqueueJob;
  transaction: Db;
}) => {
  const restockItems = await transaction.query.refundItem.findMany({
    where: {
      refund_id: refundId,
      restock_quantity: { gt: 0 },
    },
    columns: {
      restock_quantity: true,
    },
    with: {
      order_item: {
        columns: {
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

  const subscribers = await transaction.query.webhookSubscription.findMany({
    where: { event: "order.refunded" },
    columns: { url: true },
  });

  for (const subscriber of subscribers) {
    await enqueueJob({
      type: "deliverOrderRefundedWebhookEvent",
      payload: { refundId, url: subscriber.url },
    });
  }
};

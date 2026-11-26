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
      refundId,
      restockQuantity: { gt: 0 },
    },
    columns: {
      restockQuantity: true,
    },
    with: {
      orderItem: {
        columns: {
          productId: true,
        },
      },
    },
  });

  await restockProductStock({
    items: restockItems.map((item) => ({
      productId: item.orderItem.productId,
      quantity: item.restockQuantity,
    })),
    transaction,
  });

  const restockedProductIds = restockItems.flatMap((item) =>
    item.orderItem.productId == null ? [] : [item.orderItem.productId],
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

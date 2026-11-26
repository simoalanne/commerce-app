import { releaseReservedStock } from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import { enqueueProductStockInvalidationJobs } from "#src/jobs/handlers/jobAggregrates.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

type ExpirePendingOrderPayload = {
  orderId: number;
};

export async function expirePendingOrder(
  { orderId }: ExpirePendingOrderPayload,
  { runAppTransaction }: JobHandlerContext,
) {
  const result = await runAppTransaction(async ({ tx, enqueueJob }) => {
    const [order] = await tx.order.updateManyAndReturn({
      where: {
        id: orderId,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
      select: {
        id: true,
      },
    });

    if (!order) {
      return { expired: false };
    }

    const orderItems = await tx.orderItem.findMany({
      where: { order_id: orderId },
      select: {
        sku: true,
        quantity: true,
        product_id: true,
      },
    });

    await releaseReservedStock({
      items: orderItems,
      transaction: tx,
    });
    await enqueueProductStockInvalidationJobs({
      productIds: orderItems.flatMap((item) => (item.product_id == null ? [] : [item.product_id])),
      enqueueJob,
    });

    return { expired: true };
  });

  if (result.expired) {
    logger.info("Pending order expired", {
      tag: "expire-pending-order-job",
      orderId,
    });
  }
}

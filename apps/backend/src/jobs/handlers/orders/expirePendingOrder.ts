import { and, eq } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { orderTable } from "#src/db/schema.ts";
import {
  enqueueProductStockInvalidationJobs,
  releaseReservedStock,
} from "#src/features/customer-api/checkout/checkout.adjustStock.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

type ExpirePendingOrderPayload = {
  orderId: number;
};

export async function expirePendingOrder(
  { orderId }: ExpirePendingOrderPayload,
  { jobQueue }: JobHandlerContext,
) {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(orderTable)
      .set({ status: "EXPIRED" })
      .where(and(eq(orderTable.id, orderId), eq(orderTable.status, "PENDING")))
      .returning({ id: orderTable.id });

    if (!order) {
      return { expired: false };
    }

    const orderItems = await tx.query.orderItem.findMany({
      where: { orderId },
      columns: {
        sku: true,
        quantity: true,
        productId: true,
      },
    });

    await releaseReservedStock({
      items: orderItems,
      transaction: tx,
    });
    await enqueueProductStockInvalidationJobs({
      productIds: orderItems.flatMap((item) => (item.productId == null ? [] : [item.productId])),
      enqueueJob: (job) => jobQueue.enqueue(tx, job),
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

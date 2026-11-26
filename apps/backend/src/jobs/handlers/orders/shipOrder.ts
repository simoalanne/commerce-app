import { and, eq } from "drizzle-orm";

import envConfig from "#src/config.ts";
import { db } from "#src/db/client.ts";
import { orderTable } from "#src/db/schema.ts";
import type { JobHandlerContext } from "#src/jobs/queue.ts";
import logger from "#src/logger.ts";

type ShipOrderPayload = {
  orderId: number;
};

// Stands in for fulfilment until the store models shipping: a paid order
// counts as shipped once this runs, ORDER_SHIP_DELAY_SECONDS after payment.
export async function shipOrder({ orderId }: ShipOrderPayload, { jobQueue }: JobHandlerContext) {
  const shipped = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(orderTable)
      .set({ status: "SHIPPED" })
      .where(and(eq(orderTable.id, orderId), eq(orderTable.status, "PAID")))
      .returning({ id: orderTable.id });
    if (!order) return false;

    await jobQueue.enqueue(tx, {
      type: "sendOrderReviewInvitationEmail",
      payload: { orderId },
      options: { startAfter: envConfig.REVIEW_INVITATION_DELAY_SECONDS },
    });
    return true;
  });

  if (shipped) logger.info("Order shipped", { tag: "ship-order-job", orderId });
}

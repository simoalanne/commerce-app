import { eq, sql } from "drizzle-orm";

import { db } from "#src/db/client.ts";
import { orderTable } from "#src/db/schema.ts";
import { jobQueue } from "#src/jobs/queue.ts";
import { createOrder } from "#src/tests/factories.ts";

import { shipOrder } from "./shipOrder.ts";

const findInvitationJobs = async (orderId: number) =>
  (
    await db.execute<{ id: string }>(sql`
      SELECT id FROM pgboss.job
      WHERE name = 'sendOrderReviewInvitationEmail'
        AND data @> ${JSON.stringify({ orderId })}::jsonb
    `)
  ).rows;

const findStatus = async (orderId: number) =>
  (
    await db
      .select({ status: orderTable.status })
      .from(orderTable)
      .where(eq(orderTable.id, orderId))
  )[0]?.status;

describe("shipOrder", () => {
  it("ships a paid order and enqueues the review invitation", async () => {
    const order = await createOrder({}, "PAID");

    await shipOrder({ orderId: order.id }, { jobQueue });

    expect(await findStatus(order.id)).toBe("SHIPPED");
    expect(await findInvitationJobs(order.id)).toHaveLength(1);
  });

  it("leaves orders that are not paid alone", async () => {
    const pending = await createOrder({}, "PENDING");
    const shipped = await createOrder({}, "SHIPPED");

    await shipOrder({ orderId: pending.id }, { jobQueue });
    await shipOrder({ orderId: shipped.id }, { jobQueue });

    expect(await findStatus(pending.id)).toBe("PENDING");
    expect(await findInvitationJobs(pending.id)).toHaveLength(0);
    expect(await findInvitationJobs(shipped.id)).toHaveLength(0);
  });
});

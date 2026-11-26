import { db } from "#src/db/client.ts";

import { jobQueue } from "./queue.ts";

const findExpiryJobs = async (orderId: number) =>
  (await jobQueue.listRecent(1000)).filter(
    (job) =>
      job.type === "expirePendingOrder" &&
      (job.payload as { orderId?: number }).orderId === orderId,
  );

describe("jobQueue", () => {
  it("keeps a job enqueued in a transaction that commits", async () => {
    await db.transaction(async (tx) => {
      await jobQueue.enqueue(tx, {
        type: "expirePendingOrder",
        payload: { orderId: 9001 },
        options: { startAfter: 60 },
      });
    });

    const [job] = await findExpiryJobs(9001);
    expect(job).toMatchObject({ state: "created", retryLimit: 2 });
    expect(job.startAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it("drops a job enqueued in a transaction that rolls back", async () => {
    await expect(
      db.transaction(async (tx) => {
        await jobQueue.enqueue(tx, { type: "expirePendingOrder", payload: { orderId: 9002 } });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(await findExpiryJobs(9002)).toEqual([]);
  });

  it("passes send options through", async () => {
    await jobQueue.enqueue(db, {
      type: "processRefund",
      payload: { refundId: 9003 },
      options: { retryLimit: 0 },
    });

    const [job] = (await jobQueue.listRecent(1000)).filter(
      (entry) => (entry.payload as { refundId?: number }).refundId === 9003,
    );
    expect(job).toMatchObject({ type: "processRefund", retryLimit: 0 });
  });
});

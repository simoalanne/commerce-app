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
        delayMs: 60_000,
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

  it("takes the retry limit from maxAttempts", async () => {
    await jobQueue.enqueue(db, {
      type: "processRefund",
      payload: { refundId: 9003 },
      maxAttempts: 1,
    });

    const [job] = (await jobQueue.listRecent(1000)).filter(
      (entry) => (entry.payload as { refundId?: number }).refundId === 9003,
    );
    expect(job).toMatchObject({ type: "processRefund", retryLimit: 0 });
  });
});

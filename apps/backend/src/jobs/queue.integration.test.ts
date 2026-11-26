import { sql } from "drizzle-orm";

import { db } from "#src/db/client.ts";

import { jobQueue } from "./queue.ts";

type JobRow = { state: string; retryLimit: number; startAfter: Date };

const findJobs = async (name: string, payload: Record<string, number>) =>
  (
    await db.execute<JobRow>(sql`
      SELECT state, retry_limit AS "retryLimit", start_after AS "startAfter"
      FROM pgboss.job
      WHERE name = ${name} AND data @> ${JSON.stringify(payload)}::jsonb
    `)
  ).rows;

describe("jobQueue", () => {
  it("keeps a job enqueued in a transaction that commits", async () => {
    await db.transaction(async (tx) => {
      await jobQueue.enqueue(tx, {
        type: "expirePendingOrder",
        payload: { orderId: 9001 },
        options: { startAfter: 60 },
      });
    });

    const [job] = await findJobs("expirePendingOrder", { orderId: 9001 });
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

    expect(await findJobs("expirePendingOrder", { orderId: 9002 })).toEqual([]);
  });

  it("passes send options through", async () => {
    await jobQueue.enqueue(db, {
      type: "processRefund",
      payload: { refundId: 9003 },
      options: { retryLimit: 0 },
    });

    const [job] = await findJobs("processRefund", { refundId: 9003 });
    expect(job).toMatchObject({ retryLimit: 0 });
  });
});

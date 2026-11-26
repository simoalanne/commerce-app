import { db } from "#src/db/client.ts";
import { jobQueue } from "#src/jobs/queue.ts";

// Routes enqueue jobs, which needs the queue started; no workers run, so the
// tests see enqueued jobs as rows.
beforeAll(async () => {
  await jobQueue.start();
});

afterAll(async () => {
  await jobQueue.stop();
  await db.$client.end();
});

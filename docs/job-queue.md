# Job Queue

Last updated: 2026-11-26

## Purpose

Background work that must not be lost (order expiry, emails, webhook deliveries, storefront cache and search index invalidation) runs as jobs on [pg-boss](https://github.com/timgit/pg-boss), a Postgres-backed queue that runs inside the backend process. Its tables live in their own `pgboss` schema in the app database; pg-boss creates and migrates them on start.

The code is `apps/backend/src/jobs/`:

- `jobDefinitions.ts`: one entry per job type, with a Zod schema for the payload and the handler. A pg-boss queue is created for each type.
- `queue.ts`: the `JobQueue` the app uses (`enqueue`, `start`, `work`, `stop`), built on one `PgBoss` instance.
- `handlers/`: the handlers.

## Transactional Enqueue

A job is a row, written through the database connection the caller passes:

```ts
await db.transaction(async (tx) => {
  await tx.update(orderTable).set({ status: "EXPIRED" }).where(eq(orderTable.id, orderId));
  await jobQueue.enqueue(tx, { type: "invalidateSearchIndex", payload: { productIds } });
});
```

Given a transaction, the job exists only if the transaction commits, and workers see it after the commit. A rolled-back change leaves no follow-up jobs, and a committed one cannot lose them.

Route handlers built with `customerTxRoute` / `dashboardTxRoute` get `context.enqueueJob(job)`, which enqueues in the handler's transaction. Plain routes that open their own transactions, jobs and webhooks call `jobQueue.enqueue(tx, job)`; job handlers get the queue from their handler context, and webhooks import it.

Per-job settings are pg-boss's send options, passed as `options`: `{ startAfter: seconds }` delays a job, `{ retryLimit: 0 }` runs it at most once.

## Running Jobs

`index.ts` calls `jobQueue.start()` before serving requests, since enqueueing looks queues up through pg-boss, then `jobQueue.work({ jobQueue })` to run the handlers in the same process. pg-boss claims jobs with `SELECT ... FOR UPDATE SKIP LOCKED`, so several backend instances can run workers against the same database without running a job twice.

Each worker validates the payload with the job's schema, runs the handler, and logs a failure before rethrowing it to pg-boss.

Workers poll their queue (every 2 seconds by default). This keeps the database awake, which matters only for a database that scales to zero; raise pg-boss's polling interval if that becomes a cost.

## Retries

Every queue uses the same policy (`queueOptions` in `queue.ts`): two retries with exponential backoff starting at 5 minutes, capped at an hour. Most jobs succeed on the first attempt, and the rare failure is unlikely to clear up immediately. Jobs that must not repeat, such as refunds, enqueue with `retryLimit: 0`.

A job that exhausts its retries is `failed` and stays in pg-boss's table. Pending-order expiry has no extra safety net: if `expirePendingOrder` fails three times, the order's stock stays reserved until the job is retried.

Handlers should be idempotent where practical: a worker can crash after the work but before pg-boss records completion, and the job then runs again.

## Tests

The integration test setup (`src/tests/`) installs pg-boss's schema and queues in the test database and clears its jobs before a run, and starts the queue without workers in each test file, so tests can enqueue and inspect jobs without running them.

# Job Queue Architecture

Last updated: 2026-07-12

## Purpose

This document explains the backend job queue used by `apps/backend`.

The current queue is a practical middle point between:

- simple fire-and-forget async work that can be lost if the process exits
- a proper distributed queue with workers, polling, leases, visibility timeouts, and operational overhead

It is not intended to be a forever architecture. It exists because the current product needs more reliability than in-process fire-and-forget work, but does not yet need the cost and complexity of a dedicated queue system due to running a single persistent backend instance deployment with low job volume.

## Current Model

The queue is implemented by `PersistentInMemoryJobQueue`.

It has two parts:

- persistent job state in the Postgres `Job` table
- in-memory timers in the backend process for scheduling when jobs should run

Creating a job writes a row to the database. Running a job updates that row through normal statuses:

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`

The database is the durable record of what jobs exist and what happened to them. The Node process memory is only used to avoid repeatedly asking the database which job should run next.

## Why Not Simple Fire And Forget?

Fire-and-forget work is the simplest option:

```ts
void doSomethingInBackground();
```

That is fine for best-effort behavior where losing the work is acceptable.

It is not a good fit for work that should survive:

- process restarts
- deploys
- crashes while a handler is running
- short-lived server instances
- transient third-party failures

Important examples include:

- expiring pending orders
- invalidating storefront cache after stock changes
- sending emails
- delivering webhook events

For those cases, the system should be able to say "this work exists" before the handler actually runs. That is why jobs are persisted in the database first.

## Why Not A Proper Distributed Queue Yet?

A proper queue system would be more robust.

Typical features would include:

- separate worker processes
- polling or blocking reads
- leases or visibility timeouts
- dead-letter queues
- better concurrency control across multiple instances
- queue-specific observability and tooling

That is the right direction if job volume grows, if multiple backend instances need to process jobs concurrently, or if background work becomes operationally important enough to deserve its own infrastructure.

The current app does not need all of that yet.

The goal for now is to get closer to normal queue semantics while keeping the deployment model simple.

## Why In-Memory Scheduling?

The in-memory scheduling is not used because polling would be difficult.

Polling would actually be simpler in some ways:

- run a loop
- query for due `PENDING` jobs
- claim one or more rows
- sleep
- repeat

The reason we avoid polling is cost and deployment behavior.

The project uses serverless database hosting. If the backend polls the database continuously, the database can never scale to zero. More aggressive polling also means more database requests, which increases cost even when the product is idle.

That is especially wasteful for this application because background jobs are expected to be low volume. Most of the time there may be no job due at all, so polling would mostly pay to confirm that nothing changed.

The current queue therefore does this instead:

- persist jobs in Postgres
- schedule due times in memory with timers
- hydrate pending jobs on process startup
- repair known startup gaps before scheduling

This keeps idle database traffic much lower while still giving jobs a durable record.

## Startup Hydration

Because timers live only in process memory, startup hydration is important.

When the backend starts, it:

1. requeues any jobs left in `RUNNING`
2. creates missing pending-order expiry jobs for existing `PENDING` orders
3. loads `PENDING` jobs from the database
4. schedules them in memory

This is the main compensation for not polling.

The startup repair is intentionally simple. It is not trying to become a general recovery framework. It only handles the cases this lightweight queue model can otherwise miss:

- a process crashed or deployed while a job was marked `RUNNING`
- pending orders already existed before an expiry job was created for them

## Transactional Enqueue

Some backend work needs to create database changes and jobs together.

Route handlers get this from the transactional builders (`customerTxRoute` / `dashboardTxRoute` in `src/routing/base.ts`); jobs and webhooks use `runAppTransaction(...)` from `apps/backend/src/utils/runAppTransaction.ts` directly. The pattern is:

- open a Prisma transaction
- make the domain change
- create any follow-up jobs through the transaction context
- optionally write admin action logs through the same transaction context
- commit
- schedule the newly created jobs in memory after commit

This matters because the system should not enqueue follow-up work for a transaction that later rolls back.

In a transactional route handler, the shape is:

```ts
await context.db.someModel.update(...);

await logAdminAction(context.db, {
	actor: context.authContext,
	action: "OTHER",
	entity: "someEntity",
	entityId,
	details: { operation: "some.operation" },
});

await context.enqueueJob({
	type: "invalidateStorefrontCache",
	payload: { tags },
});
```

`enqueueJob(...)` writes the job row using the transaction client. The transaction wrapper records the created job ids and schedules them only after the database transaction commits successfully.

This means:

- rolled back domain changes do not leave scheduled follow-up jobs behind
- committed domain changes have their coupled job rows persisted atomically
- in-memory scheduling still happens outside the transaction, after commit
- admin action logs can be committed atomically with the same domain change

Examples:

- checkout reserves stock and creates an expiry job
- payment reconciliation updates order state and enqueues stock cache invalidation
- pending-order expiry releases stock and enqueues stock cache invalidation
- dashboard content updates enqueue storefront cache invalidation and write admin action logs

## Handler Context

Job handlers can receive a small handler context.

The main current use is giving handlers access to `runAppTransaction(...)`.

That lets a job make domain changes, enqueue follow-up jobs, and write any needed transactional side effects without importing the queue singleton directly.

This avoids circular dependencies while keeping the queue API explicit. It should stay small. If the handler context starts growing into a service locator, that is a sign the queue design is drifting.

## Failure And Retry Behavior

When a job is claimed, it moves from `PENDING` to `RUNNING` and increments its attempt count.

If the handler succeeds, the job becomes `COMPLETED`.

If the handler fails, the job either:

- returns to `PENDING` with a retry delay if attempts remain
- becomes `FAILED` if attempts are exhausted

The retry delays are intentionally simple and fixed. This is enough for rare transient failures without adding a full retry policy system.

## Known Tradeoffs

This model is more reliable than fire-and-forget work because jobs are persisted before they run.

It is cheaper at idle than polling because the backend does not constantly query the database for due jobs.

But it is less robust than a real distributed queue.

Important limitations:

- it assumes a single backend instance is the normal deployment shape
- in-memory timers are lost on process exit and must be reconstructed on startup
- there is no continuous polling safety net
- there is no real lease or visibility-timeout model
- there is no separate worker process
- queue state and app data share the same database
- advanced queue operations need manual database inspection

These are acceptable tradeoffs only while job volume is low and the operational model is simple.

## When To Replace It

This queue should be revisited if any of these become true:

- backend runs multiple instances that should all process jobs
- job volume grows enough that in-memory timers become awkward
- delayed jobs become business-critical at high volume
- failed jobs need richer dead-letter or replay tooling
- queue observability becomes important for operations
- polling cost becomes acceptable compared to reliability needs
- a managed queue becomes easy to add in the deployment environment

Likely replacements include:

- a managed queue service
- a Redis-backed queue
- a database-backed queue with real polling, leases, and worker processes

## Decision Rule For Now

For the current stage:

- use persisted jobs for work that should not be lost
- keep handlers idempotent where practical
- use transactional enqueue when jobs are coupled to database changes
- avoid adding broad queue abstractions before they are needed
- keep startup hydration simple and explicit
- move to a real queue when production behavior justifies it

The queue should solve today's reliability and cost problem, not pretend to be permanent infrastructure.

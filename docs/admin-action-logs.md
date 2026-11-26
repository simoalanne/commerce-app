# Admin Action Logs

Last updated: 2026-07-12

## Purpose

Admin action logs record important dashboard-side mutations performed by admins.

They are not meant to replace product-specific history tables, payment provider logs, job logs, or database backups. They are a lightweight operational audit trail for answering questions like:

- who changed this dashboard-managed resource?
- who performed this moderation or operational action?
- what entity was affected?
- what compact details were known at the time?

## Current Model

Admin actions are stored in the Postgres `AdminActionLog` table.

Each row stores:

- the admin account id when available
- the admin email at the time of the action
- an action type
- an entity name
- an optional entity id
- JSON details
- creation time

The current action types are:

- `CREATE`
- `UPDATE`
- `DELETE`
- `OTHER`

`CREATE`, `UPDATE`, and `DELETE` are used for normal dashboard CRUD-style mutations.

`OTHER` is used for meaningful admin actions that are not simple resource CRUD, such as moderation decisions, delivery status changes, or granting admin access.

## Implementation

The logging utility is in:

- `apps/backend/src/utils/adminActionLog.ts`

Handlers call it inside a transactional route (`dashboardTxRoute`), passing the transaction as `context.db`:

```ts
const updated = await context.db.someModel.update(...);

await logAdminAction(context.db, {
	actor: context.authContext,
	action: "UPDATE",
	entity: "someEntity",
	entityId: updated.id,
	before: existingRecord,
	after: updated,
});
```

For non-CRUD actions, use `details` instead of `before` and `after`:

```ts
await logAdminAction(context.db, {
  actor: context.authContext,
  action: "OTHER",
  entity: "review",
  entityId: reviewId,
  details: {
    operation: "review.updateStatus",
    reviewId,
    fromStatus,
    toStatus,
  },
});
```

The logger requires an authenticated admin actor. If `authContext.adminId` is missing, logging throws because admin action logs should never be written anonymously.

## Transaction Boundary

Admin action logs are written in the same transaction as the mutation they describe: the handler runs on a transactional builder, so both go through `context.db`.

That keeps the mutation and the log atomic:

- if the transaction commits, both the data change and the log row exist
- if the transaction rolls back, neither is written

Reads used only to build informational log details may happen before the transaction when that keeps the transaction shorter.

That means an old-state value such as `fromStatus` can theoretically be stale if another admin changes the same row between the pre-read and the transaction. This is acceptable for the current dashboard action logs because those values are informational and not used for correctness checks.

Do not rely on stale pre-reads for:

- authorization
- business invariants
- financial correctness
- preventing duplicate actions
- legally precise before/after history

If exact old state matters, read it inside the transaction or use a stronger update pattern.

## What Gets Logged

The current intended scope is dashboard admin mutations that are stable and useful to audit.

CRUD-style resources include:

- categories
- products
- vendors
- tags
- promotion codes
- webhooks
- legal documents
- images

Non-CRUD admin actions include:

- review status updates
- contact submission status updates
- granting admin access

## What Does Not Get Logged

Some dashboard writes are intentionally not part of this pass.

Examples:

- order refunds, because that flow is being changed separately
- search index reindexing, because the manual endpoint is temporary operational tooling
- translation batch updates, because the feature may be scrapped or redesigned
- image storage sync, because it is dangerous repair tooling and should not be treated as a normal admin action
- presigned image URL creation, because it does not persist app state by itself
- route optimization, because it is a compute/read operation

Logging should not give temporary or dangerous repair tools the appearance of normal supported admin workflows.

## Details Payloads

Keep `details` compact and intentional.

Good details payloads include stable identifiers and decision data:

```json
{
  "operation": "contactSubmission.updateStatus",
  "submissionId": 123,
  "fromStatus": "OPEN",
  "toStatus": "RESOLVED",
  "topic": "CONTACT"
}
```

Avoid storing:

- large full records unless before/after snapshots are genuinely useful
- secrets
- access tokens
- payment provider payloads
- huge arrays
- noisy request bodies

Use a stable `operation` string for `OTHER` actions so the dashboard can filter and search them predictably later.

## Dashboard UI

The dashboard exposes a readonly admin action log page at:

- `/admin-action-logs`

The endpoint is:

- `dashboardApi.adminActionLogs.getAll`

For now it returns the latest 1000 rows, ordered newest first.

The UI intentionally mirrors the job queue page:

- table view
- refresh button
- searchable columns
- click row to open details
- modal with full JSON details

This is intentionally simple. If the log becomes operationally important, filters and pagination can be added later and these two overlapping pages can be merged.

## Retention

There is currently no retention job for admin action logs.

That is acceptable while volume is low, but the table should not grow forever.

Future cleanup should define:

- how long admin action logs are kept
- whether security-sensitive actions are retained longer
- whether operational tables like `Job` and `AdminActionLog` share cleanup infrastructure
- which indexes are needed for common dashboard queries

Retention should be implemented as scheduled backend maintenance, not request-path logic.

## Decision Rule For Now

For the current stage:

- log stable dashboard mutations that are useful for accountability
- keep logs in the same transaction as the mutation (a `dashboardTxRoute` handler)
- use CRUD action types for resource lifecycle changes
- use `OTHER` with compact details for moderation, security, and operational actions
- avoid logging temporary, dangerous, or unclear features until their design settles
- defer retention and advanced filtering until real volume justifies it

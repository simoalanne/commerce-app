# Admin Action Logs

Last updated: 2026-11-26

An operational audit trail of dashboard writes: who did what, when, and how it ended. Not a field-level history, and not a replacement for payment provider logs, job logs or backups.

## Model

`dashboardTxRoute`'s middleware (`apps/backend/src/routing/base.ts`) writes one `admin_action_log` row per request. The route is the action, so there are no call sites:

- `adminAccountId`: the admin. The email is resolved from the auth provider when the log is read, not stored.
- `route`: method and path, such as `PUT /api/dashboard/products/:id`.
- `params` and `body`: the validated request.
- `status` and `result`: the response status and body, or the error's status and `{ code, data }`.

A successful action is logged in the route's transaction, so the log commits with the change. A failed one rolls back and is logged after. Requests rejected before the handler (auth, validation) are not logged.

Routes on the plain `dashboardRoute` are not logged; the only non-read among them creates presigned upload URLs, which changes nothing.

If a route ever takes a body field that must not be stored, such as a password, add a route meta option to leave it out.

## Dashboard

`/admin-action-logs` lists the latest 1000 rows (`dashboardApi.adminActionLogs.getAll`); a row opens its params, body and result.

## Retention

None yet. When volume justifies it, add a scheduled cleanup job rather than request-path logic.

# Database

Last updated: 2026-11-26

The backend uses [Drizzle](https://orm.drizzle.team) 1.0 with node-postgres. This page covers the project's conventions and the Drizzle behavior TypeScript does not catch; the Drizzle docs cover the rest.

## Layout

- `apps/backend/src/db/schema.ts`: tables (`productTable`) and enums (`orderStatusEnum`, with a union type `OrderStatus`). Tables use `snakeCase.table`: keys are camelCase (`createdAt`), columns snake_case (`created_at`), so query results are already in the API's shape.
- `src/db/relations.ts`: relations for `db.query.*`.
- `src/db/json.ts`: types of the JSON columns, attached with `.$type<T>()`.
- `src/db/client.ts`: the `db` instance and the `Db` type, which is the database or a transaction.
- `src/db/errors.ts`: `isUniqueViolation` (`23505`) and `isForeignKeyViolation` (`23503`, `23001`).

Route modules may import `drizzle-orm`, `#src/db/schema.ts`, `#src/db/json.ts` and `#src/db/errors.ts` at runtime; `#src/db/client.ts` connects, so they import it as a type only and use `context.db`.

Schema changes: edit `schema.ts`, then `pnpm --filter backend db:push`. There are no migrations.

## Conventions

- Select the fields a response needs with `columns` / `with` and return the result, instead of loading whole rows and mapping them field by field.
- A missing row in a route is `if (!row) throw new RouteError("NOT_FOUND", { status: 404 })`, not declared with `.error(...)`; clients handle 404 generically. Jobs throw a plain `Error`.
- Writes that must stay atomic, or that enqueue jobs, run in a transaction: the `*TxRoute` builders in routes, `db.transaction(async (tx) => ...)` elsewhere, with `jobQueue.enqueue(tx, job)` (see `job-queue.md`).

## Traps

- In relational `where`, **`undefined` throws**, for a field and for `where` itself. Spread optional filters in only when set: `...(query.status && { status: query.status })`.
- **`null` is not `IS NULL`**: write `{ customerId: { isNull: true } }`.
- An empty `OR` / `AND` array throws, and so does `insert(...).values([])`.
- `set()` skips `undefined` values; a `set()` with nothing left throws.
- `updatedAt` is set by `$onUpdate` on Drizzle updates only. Raw SQL updates set `updated_at` themselves.
- Raw SQL (`db.execute<Row>(sql`...`)`) uses the column names, and its rows are what node-postgres returns: alias columns to camelCase (`AS "createdAt"`), and expect `numeric`, `bigint` and `count(*)` as strings. Interpolate tables as `${productTable}`. An array interpolated into `sql` becomes separate parameters; pass it as one with `sql.param(values)`.

# Database

Last updated: 2026-11-26

The backend uses [Drizzle](https://orm.drizzle.team) 1.0 with node-postgres. This page is the conventions for writing queries, and the guide for translating the Prisma queries the backend used before.

## Layout

- `apps/backend/src/db/schema.ts`: tables and enums. Tables are exported as `<entity>Table` (`productTable`), enums as `<name>Enum` with a matching union type (`OrderStatus`). Column keys are the column names (`created_at`), as they were under Prisma.
- `src/db/relations.ts`: the relations for relational queries. Query names are the entity names (`db.query.product`), relation names are the former Prisma relation fields (`product.images`, `order.order_items`).
- `src/db/json.ts`: the types of the JSON columns, attached with `.$type<T>()`.
- `src/db/client.ts`: the `db` instance and the `Db` type, which is the database or a transaction.
- `src/db/errors.ts`: `isUniqueViolation`, `isForeignKeyViolation`.

Route modules may import `drizzle-orm`, `#src/db/schema.ts`, `#src/db/json.ts` and `#src/db/errors.ts` at runtime. `#src/db/client.ts` connects, so they import it as a type only and use `context.db`.

Schema changes: edit `schema.ts`, then `pnpm --filter backend db:push` (`drizzle-kit push`).

## Defaults Prisma filled in

- `@updatedAt` columns are `updatedAt()` in `schema.ts`: `defaultNow()` plus `$onUpdate(() => new Date())`, applied by Drizzle on every `update()`. Raw SQL updates must set `updated_at` themselves.
- `uuid(7)` defaults are the database's `uuidv7()` (Postgres 18).

## Reads

| Prisma                                                                 | Drizzle                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `db.product.findMany({ where, select, include, orderBy, take, skip })` | `db.query.product.findMany({ where, columns, with, orderBy, limit, offset })`              |
| `findUnique` / `findFirst`                                             | `findFirst` (returns `undefined`, not `null`)                                              |
| `select: { id: true, vendor: { select: { name: true } } }`             | `columns: { id: true }, with: { vendor: { columns: { name: true } } }`                     |
| `include: { images: true }`                                            | `with: { images: true }` (all columns are selected by default)                             |
| `orderBy: { created_at: "desc" }` or an array of those                 | `orderBy: { created_at: "desc" }` (one object, keys in priority order)                     |
| `_count: { select: { reviews: true } }`                                | `extras: { reviewCount: (t) => db.$count(reviewTable, eq(reviewTable.product_id, t.id)) }` |
| `count({ where })`                                                     | `db.$count(table, condition)`                                                              |
| `aggregate` / `groupBy`                                                | `db.select({ total: sum(t.x).mapWith(Number) }).from(t).where(...).groupBy(...)`           |

A missing row in a route is a 404: `if (!row) throw new RouteError("NOT_FOUND", { status: 404 })`. It is not declared with `.error(...)` on routes; clients handle 404 in their generic error handling. Jobs throw a plain `Error`.

### `where`

Relational queries take an object filter like Prisma's, with these differences:

- **`undefined` throws** (`Unexpected 'undefined' in filter value`), for a field and for `where` itself. Prisma ignored it, so optional filters were written as `{ status: query.status }`. Spread them in only when set: `...(query.status && { status: query.status })`, and leave `where` out rather than passing `undefined`. TypeScript does not catch this.
- **`null` is not `IS NULL`.** Write `{ customer_id: { isNull: true } }`; Prisma's `{ not: null }` is `{ isNotNull: true }`.
- Operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `like`, `ilike`, `isNull`, `isNotNull`, and `AND`, `OR`, `NOT` at either level. An empty `in` array matches nothing, as in Prisma; an empty `OR`/`AND` array throws.
- `contains` with `mode: "insensitive"` is `ilike: `%${term}%``; `startsWith` is `like: `${term}%``.
- A relation key filters by existence: `{ reviews: { status: "APPROVED" } }` is Prisma's `some`; `{ reviews: true }` means at least one. `none` is `NOT: { reviews: {...} }`; `every` is `NOT: { reviews: { NOT: {...} } }`.
- Anything else, such as JSON paths, is `RAW: (t) => sql`...``. Prisma's `order_details: { path: ["customer", "email"], equals: email }` is `RAW: (t) => sql`${t.order_details}->'customer'->>'email' = ${email}``.

Core queries (`db.select()`, `db.update()`, `db.delete()`) take conditions built with `eq`, `and`, `inArray`, ... from `drizzle-orm`; `and(...)` skips `undefined` arguments, so optional conditions are fine there.

## Writes

| Prisma                                 | Drizzle                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create({ data })`                     | `const [row] = await db.insert(t).values({...}).returning()`                                                                                               |
| `createMany({ data })`                 | `db.insert(t).values([...])`; guard against an empty array, which throws                                                                                   |
| `createMany({ skipDuplicates: true })` | `.onConflictDoNothing()`                                                                                                                                   |
| `update({ where: { id }, data })`      | `const [row] = await db.update(t).set({...}).where(eq(t.id, id)).returning()`, then the 404 check: Prisma threw for a missing row, Drizzle updates nothing |
| `updateMany` / `updateManyAndReturn`   | `db.update(t).set(...).where(...)`, with `.returning()` when the rows are needed                                                                           |
| `delete` / `deleteMany`                | `db.delete(t).where(...)`, with `.returning()` and the 404 check where a missing row matters                                                               |
| `upsert`                               | `db.insert(t).values(...).onConflictDoUpdate({ target: [...], set: {...} })`, with an explicit conflict target                                             |
| `{ increment: n }`                     | `sql`${t.col} + ${n}``                                                                                                                                     |
| Nested `create` / `connect`            | Explicit inserts in the same transaction; `connect` is setting the foreign key column                                                                      |
| `select` on a write                    | `.returning({ id: t.id })`                                                                                                                                 |

`set()` skips `undefined` values, like Prisma's `data`. An update whose values are all `undefined` throws `No values to set`.

## Raw SQL

`prisma.$queryRaw<Row[]>`...`` is `(await db.execute<Row>(sql`...`)).rows`. `Prisma.join(values)` is `sql.join(values.map((v) => sql`${v}`), sql`, `)`, and `Prisma.sql` fragments are `sql` fragments. Raw rows are what node-postgres returns: `timestamptz` columns are `Date`, `numeric`, `bigint` and `count(*)` are strings. Arrays interpolated into `sql` are expanded into separate parameters; pass one array parameter with `sql.param(values)`.

## Transactions and jobs

Routes that write get a transaction from `customerTxRoute` / `dashboardTxRoute`. Elsewhere:

```ts
await db.transaction(async (tx) => {
  await tx.update(orderTable).set({ status: "PAID" }).where(eq(orderTable.id, orderId));
  await jobQueue.enqueue(tx, { type: "sendOrderConfirmationEmail", payload: { orderId } });
});
```

`db.transaction()` inside a transaction opens a savepoint. `jobQueue.enqueue(tx, job)` writes the pg-boss job in the same transaction, so it exists only if the transaction commits (see `job-queue.md`).

## Errors

- Not found: `orNotFound(row)` throws a `NotFoundError`, which the API sends as a 404.
- Prisma's `P2002` is `isUniqueViolation(error)` (Postgres `23505`); `P2003` and deletes blocked by a reference are `isForeignKeyViolation(error)` (`23503`, or `23001` for `RESTRICT`).

## Types

- Row types: `typeof productTable.$inferSelect`. For a query's shape, infer it from the query (`Awaited<ReturnType<typeof findX>>`) instead of Prisma's `GetPayload`.
- `numeric` columns are `number` (`mode: "number"`), so there is no `Decimal`.

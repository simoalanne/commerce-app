# Roadmap

The project is a general commerce core: catalog, cart, checkout, orders, refunds, promotion codes, reviews, legal documents and admin, on contracts and data it owns. It doesn't take the usual route of assembling bought services. It moves to a simpler owned architecture on Bun and TanStack that runs with no mandatory configuration and no SaaS accounts, and makes it easy to add features off-the-shelf stacks don't give.

## Principles

- **Own the contract and the data; depend on libraries, not platforms.** Platforms that own the data model or the API (hosted auth, commerce engines, hosted CMS) get replaced or avoided. In-process libraries are fine.
- **One vertical slice at a time.** Each change ends with a green `pnpm check`.
- **No compatibility work.** Nothing is deployed, so schema changes go straight through and there is no data to migrate.

## Order

1. **Local-first foundation.** A single Bun server and defaults that need no accounts: filesystem object storage, a console email adapter, a dev payment provider and a seed script, so that `docker compose up` and `pnpm dev` work out of the box. Every later step is verified on it.
2. **Clerk → Better Auth**, removing the last hard external dependency.
3. **Decisions that gate Drizzle:** money representation, and localized JSON columns or translation tables.
4. **Drizzle**, together with the Postgres-backed queue and removing `runAppTransaction`.
5. **Test runner** on Bun.
6. **TanStack Start store** on the same shadcn components as the dashboard. This replaces the Next-only machinery: tag invalidation jobs, `nextCache`, next-intl and the `next/image` loader.
7. **MJML → React Email.**
8. **The remaining abstraction reviews:** the payment provider registry, and search documents or a `tsvector` column.

The sections below are input for these steps.

## Tooling Refactors

Each is its own branch; the order is the one above. The job queue and `runAppTransaction` changes from the abstraction review belong with the Drizzle port, since they touch the same call sites.

### 1. Prisma → Drizzle

Target Drizzle 1.0 (currently `1.0.0-rc`). Its relational queries (`where`, `with`, `columns`) are close to Prisma's `where`, `include` and `select`, which makes most reads translate directly.

Measure the footprint (models, query calls, nested writes, raw SQL, `runAppTransaction` uses, typed JSON columns) before planning the parallel phase. Money values are Decimal.

**Groundwork, serial, before any delegation:**

- `drizzle-kit pull` from the database to generate the schema and relations.
- Re-add the behavior Prisma implements in its client, which `pull` can't see: `@updatedAt` fields (`.$onUpdate(() => new Date())`), client-side `cuid()`/`uuid()` defaults (`$defaultFn`), and Prisma's implicit many-to-many join tables if any exist.
- Decide the money representation. Drizzle returns `numeric` as a string by default. Pick string, number mode or integer cents, and update `toResponse` and the pricing helpers to match.
- Replace the JSON types generator with `.$type<T>()`.
- Helpers: a not-found "or throw" replacing `findUniqueOrThrow`, and unique-violation mapping (Postgres `23505`) replacing the Prisma error codes in `isNotFoundError`/`tryDeleteEntity`.
- A conversion guide for the parallel phase, covering: `undefined` in `where` (Prisma ignores an undefined filter; check whether Drizzle's relational queries do the same before delegating), `_count`, case-insensitive filters (`ilike`), upserts (`onConflictDoUpdate` with an explicit target), and nested writes (explicit inserts in a transaction).

**Parallel phase:** subagents per feature folder, with the conversion guide, verified by `pnpm typecheck`.

**Verification:** typecheck, then the integration tests against the test database, then a manual pass through checkout and refunds. Types only prove query shapes; the integration tests cover the semantic differences.

Workflow stays the same: `drizzle-kit push` replaces `prisma db push`.

### 2. Clerk → Better Auth

Before Drizzle, on Better Auth's Prisma adapter, so the app runs without accounts sooner. Its few tables come over to Drizzle with `drizzle-kit pull`.

- Users move into the database. Better Auth's user table replaces `User.clerk_id` as the identity key, and most of the `AuthProvider` interface becomes plain queries.
- Better Auth's handler mounts as a plain Bun route at `/api/auth/*`, next to the webhooks. Add it to the AGENTS.md exceptions.
- Keep header-based auth with the bearer plugin, so the rest-rpc clients and the store's server-side client barely change.
- Store: the custom sign-in, sign-up and Google flows switch to Better Auth's client. Dashboard: a new login page and a replacement for Clerk's `UserProfile`.
- New owned flows: email verification and password reset (through the email integration), and the admin role (admin plugin or an own role column, replacing Clerk metadata in `grantAdmin`).

### 3. Backend runtime and test runner

The server runs on Bun; tests and scripts still run on Node. Move both to Bun, together with a test runner change.

- Scripts and the contract `postinstall`: `node scripts/x.ts` → `bun scripts/x.ts`.
- Tests (19 files): imports from `node:test` become the runner's, and `before`/`after` become `beforeAll`/`afterAll`. `node:assert` can stay, since both candidate runners accept it.
- The 4 `esmock` files need real changes. Vitest's `vi.doMock` plus `vi.resetModules()` matches esmock's fresh module per test. Bun's `mock.module` patches modules in place, so it needs mocks restored after each test.
- Integration setup: Vitest has direct `setupFiles`/`globalSetup` equivalents; Bun only has `--preload`.
- Check the dashboard's contract macro still works with the change, since it executes backend route code during the Vite build.
- CI installs Bun.

### 4. MJML and Handlebars → React Email

After the Bun move: Node's type stripping can't run `.tsx`, and route modules that render emails are imported by the contract extraction and the dashboard macro.

- The MJML templates and their render functions.
- Handlebars variables become typed component props; `mjml`, `handlebars` and `@types/mjml` go away.
- The backend tsconfig enables `jsx`.
- Check Outlook rendering against the current MJML output before switching.

## Review Of Own Abstractions

Each of the repo's own abstractions has to earn its place in a general commerce core: keep it only if it's the design you'd recommend, not just one that works. The questions for each: does it solve a problem generic commerce actually has, would a library do it better, and does it hide complexity or only move it?

### Job queue: replace

`PersistentInMemoryJobQueue` stores jobs in the database but schedules them with in-process timers. It's a poor abstraction to show:

- It only works with exactly one backend process. Two instances would both hydrate and run the same pending jobs, because there are no leases or row locks.
- Jobs enqueued in a transaction are handed to the scheduler after commit (`jobQueue.schedule(jobIds)`). If the process dies in between, they wait for the next restart.
- Every pending job, including ones due days from now, holds a timer in memory.

The good parts are the transactional enqueue (jobs are rows written in the same transaction as the change that caused them) and the typed job definitions (a Zod schema per job type). Keep both, on a Postgres-backed queue library that claims jobs with row locks (`SKIP LOCKED`), such as pg-boss or graphile-worker. Either runs in the backend process or as a separate worker, and either is safe with several instances. Enqueueing inside the caller's transaction is the whole story: the job becomes visible when the transaction commits, so the post-commit scheduling step disappears.

`docs/job-queue.md` gets rewritten with the swap. The admin job queue page stays if the library exposes job state.

### `runAppTransaction`: shrink or remove

It wraps `prisma.$transaction` and hands the callback `tx`, `enqueueJob` and `logAdminAction`, then schedules the enqueued jobs after commit. It's used about 50 times. Problems:

- It bundles three unrelated things (a transaction, job enqueueing, audit logging) into one callback context, and uses the global Prisma client and job queue despite the `AppContext` pattern.
- Its post-commit step exists only for the in-memory queue.
- It casts its way around the admin log's input type (`as LogAdminActionInput`).

With a Postgres-backed queue, the remaining job is "run this in a transaction". Two options:

- **Remove it.** Handlers call `db.transaction(async (tx) => ...)` and pass `tx` to plain helpers: `enqueue(tx, job)`, `logAdminAction(tx, entry)`. Nothing is hidden, and each helper says what it needs.
- **A small unit of work.** A transaction-scoped object with `db`, `enqueue`, `audit` and `afterCommit(fn)` for genuine post-commit side effects. Only worth it if real post-commit work appears that isn't a job.

Recommendation: remove it, unless the Drizzle port shows a recurring post-commit need. Do this together with the queue swap and the Drizzle port, since all three touch the same call sites.

### Payment provider registry: simplify

Unconfigured providers are `Proxy` stubs that throw on any property access, and the Paytrail config condition is written twice. Replace with an explicit registry of enabled providers, which the store reads to show only available options and which checkout rejects with a declared domain error. Done with the payments work.

### `AuthProvider`: collapses

The interface exists to wrap a remote identity service. After Better Auth, users are local rows, and most of it becomes plain queries. Keep only what Better Auth itself doesn't do.

### Product search documents: review

Search keeps a separate `ProductSearchDocument` table per product and locale, maintained by `invalidateSearchIndex` jobs. For a generic catalog, check whether a generated `tsvector` column (or a view) on the product data does the same job without the denormalized table and the jobs that keep it in sync. Keep the `SearchProvider` interface only if it still has more than one realistic implementation, for example semantic search later.

### Localized content in JSON columns: review

Translatable fields are stored as localized JSON objects and resolved per request by `toResponse`. That's convenient, but it shapes the whole data model. Decide whether it stays (simple, and works well with the rest-rpc response layer) or becomes translation tables. It also affects the money and JSON decisions in the Drizzle port, so decide it before the port.

### Keep as they are

- Object storage and email provider interfaces: thin adapters over real alternatives (R2/S3, Resend/SMTP).
- Storefront cache invalidation through jobs and the store's internal route: the right shape for Next.js tag caching.
- Admin action logs: generic, and useful later for auditing agent-initiated changes.
- Request context through `AsyncLocalStorage`: standard for request IDs and error tagging.

## Later

The commerce extensions (vendor features, variants, simulated shipping), payments with both Stripe and Paytrail selectable in the store, and AI features (rest-rpc contracts as agent tools, a dashboard agent, an MCP server for the store).

## Open Decisions

- Project name (`Acme` is a placeholder, one token to swap globally)
- Better Auth admin role: plugin or own column
- Vitest or Bun's test runner
- pg-boss or graphile-worker
- `runAppTransaction`: remove, or replace with a small unit of work
- Localized JSON columns or translation tables
- Checkout tips, UTM attribution, per-kg pricing and the delivery fee model: keep as core or remove

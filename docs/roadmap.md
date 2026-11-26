# Roadmap

The project is a general commerce core: catalog, cart, checkout, orders, refunds, promotion codes, reviews, legal documents and admin, on contracts and data it owns. It doesn't take the usual route of assembling bought services. It moves to a simpler owned architecture on Bun and TanStack that runs with no mandatory configuration and no SaaS accounts, and makes it easy to add features off-the-shelf stacks don't give.

## Principles

- **Own the contract and the data; depend on libraries, not platforms.** Platforms that own the data model or the API (hosted auth, commerce engines, hosted CMS) get replaced or avoided. In-process libraries are fine.
- **One vertical slice at a time.** Each change ends with a green `pnpm check`.
- **No compatibility work.** Nothing is deployed, so schema changes go straight through and there is no data to migrate.

## Order

1. **Local-first foundation.** Defaults that need no accounts: filesystem object storage, a console email adapter, a dev payment provider and a seed script, so that `docker compose up` and `pnpm dev` work out of the box. Auth still needs Clerk until the auth swap.
2. **Remove non-core features:** checkout tips, UTM attribution, per-kg pricing and the delivery fee model. Before Drizzle, so the port doesn't carry them.
3. **Scripts and tests on Bun and Vitest.**
4. **MJML → React Email.**
5. **Payment provider registry.**
6. **Drizzle**, with integer cents, pg-boss and removing `runAppTransaction`.

Deferred, not scheduled: Clerk → Better Auth, the TanStack Start store, the search documents review.

The sections below are input for these steps.

## Decisions

- **Money:** integer cents (minor units). Amount columns become `integer`, and `toResponse` and the pricing helpers work in cents.
- **Localized content:** stays in JSON columns, resolved by `toResponse`. Query-level localization may replace that later, not now.
- **Job queue:** pg-boss.
- **Test runner:** Vitest with its default setup.
- **Checkout tips, UTM attribution, per-kg pricing, delivery fee model:** not core; removed.

## Tooling Refactors

Each is its own commit series on `main`. The job queue and `runAppTransaction` changes from the abstraction review belong with the Drizzle port, since they touch the same call sites.

### Prisma → Drizzle

Target Drizzle 1.0 (currently `1.0.0-rc`). Its relational queries (`where`, `with`, `columns`) are close to Prisma's `where`, `include` and `select`, which makes most reads translate directly.

Footprint: 27 models, about 140 query calls, 20 raw SQL queries, 34 `runAppTransaction` calls in 23 files.

**Groundwork, serial, before any delegation:**

- The Drizzle schema and relations, written from `schema.prisma` (or `drizzle-kit pull` from a pushed database).
- Re-add the behavior Prisma implements in its client: `@updatedAt` fields (`.$onUpdate(() => new Date())`), client-side `cuid()`/`uuid()` defaults (`$defaultFn`), and Prisma's implicit many-to-many join tables if any exist.
- Money as integer cents: amount columns become `integer`, and `toResponse` and the pricing helpers change to match.
- Replace the JSON types generator with `.$type<T>()`.
- Helpers: a not-found "or throw" replacing `findUniqueOrThrow`, and unique-violation mapping (Postgres `23505`) replacing the Prisma error codes in `isNotFoundError`/`tryDeleteEntity`.
- A conversion guide covering: `undefined` in `where` (Prisma ignores an undefined filter; check whether Drizzle's relational queries do the same), `_count`, case-insensitive filters (`ilike`), upserts (`onConflictDoUpdate` with an explicit target), and nested writes (explicit inserts in a transaction).

**Port:** feature folder by feature folder, following the conversion guide, verified by `pnpm typecheck`.

**Verification:** typecheck, then the integration tests against the test database. Types only prove query shapes; the integration tests cover the semantic differences.

Workflow stays the same: `drizzle-kit push` replaces `prisma db push`.

### Scripts and tests on Bun and Vitest

The server runs on Bun; tests and scripts still run on Node.

- Scripts and the contract `postinstall`: `node scripts/x.ts` → `bun scripts/x.ts`.
- Tests (16 files) move to Vitest: imports from `node:test` become Vitest's, and `before`/`after` become `beforeAll`/`afterAll`. `node:assert` can stay.
- The 3 `esmock` files become `vi.doMock` plus `vi.resetModules()`, which matches esmock's fresh module per test.
- Integration setup moves to Vitest's `setupFiles`/`globalSetup`.
- Check the dashboard's contract macro still works, since it executes backend route code during the Vite build.
- CI installs Bun.

### MJML and Handlebars → React Email

After the Bun move: Node's type stripping can't run `.tsx`, and route modules that render emails are imported by the contract extraction and the dashboard macro.

- The MJML templates and their render functions.
- Handlebars variables become typed component props; `mjml`, `handlebars` and `@types/mjml` go away.
- The backend tsconfig enables `jsx`.

### Clerk → Better Auth (deferred)

- Users move into the database. Better Auth's user table replaces `User.clerk_id` as the identity key, and most of the `AuthProvider` interface becomes plain queries.
- Better Auth's handler mounts as a plain Bun route at `/api/auth/*`, next to the webhooks. Add it to the AGENTS.md exceptions.
- Keep header-based auth with the bearer plugin, so the rest-rpc clients and the store's server-side client barely change.
- Store: the custom sign-in, sign-up and Google flows switch to Better Auth's client. Dashboard: a new login page and a replacement for Clerk's `UserProfile`.
- New owned flows: email verification and password reset (through the email integration), and the admin role (admin plugin or an own role column, replacing Clerk metadata in `grantAdmin`).

## Review Of Own Abstractions

Each of the repo's own abstractions has to earn its place in a general commerce core: keep it only if it's the design you'd recommend, not just one that works. The questions for each: does it solve a problem generic commerce actually has, would a library do it better, and does it hide complexity or only move it?

### Job queue: replace with pg-boss

`PersistentInMemoryJobQueue` stores jobs in the database but schedules them with in-process timers:

- It only works with exactly one backend process. Two instances would both hydrate and run the same pending jobs, because there are no leases or row locks.
- Jobs enqueued in a transaction are handed to the scheduler after commit (`jobQueue.schedule(jobIds)`). If the process dies in between, they wait for the next restart.
- Every pending job, including ones due days from now, holds a timer in memory.

Keep the good parts: the transactional enqueue (jobs are rows written in the same transaction as the change that caused them) and the typed job definitions (a Zod schema per job type). pg-boss claims jobs with `SKIP LOCKED`, is safe with several instances, and enqueues inside the caller's transaction, so the post-commit scheduling step disappears.

`docs/job-queue.md` gets rewritten with the swap. The admin job queue page stays if pg-boss exposes the job state it needs.

### `runAppTransaction`: remove

It wraps `prisma.$transaction` and hands the callback `tx`, `enqueueJob` and `logAdminAction`, then schedules the enqueued jobs after commit. It bundles three unrelated things into one callback context, uses the global Prisma client and job queue despite the `AppContext` pattern, and casts around the admin log's input type.

Handlers call `db.transaction(async (tx) => ...)` and pass `tx` to plain helpers: `enqueue(tx, job)`, `logAdminAction(tx, entry)`. A small unit of work with `afterCommit(fn)` is only worth adding if the port shows a recurring post-commit need that isn't a job.

### Payment provider registry: simplify

Unconfigured providers are `Proxy` stubs that throw on any property access, and the Paytrail config condition is written twice. Replace with an explicit registry of enabled providers, which the store reads to show only available options and which checkout rejects with a declared domain error.

### `AuthProvider`: collapses with Better Auth (deferred)

The interface exists to wrap a remote identity service. After Better Auth, users are local rows, and most of it becomes plain queries.

### Product search documents: review (deferred)

Search keeps a separate `ProductSearchDocument` table per product and locale, maintained by `invalidateSearchIndex` jobs. Check whether a generated `tsvector` column (or a view) does the same job without the denormalized table and its sync jobs.

### Keep as they are

- Object storage and email provider interfaces: thin adapters over real alternatives (R2/S3, Resend/SMTP), plus the local defaults.
- Storefront cache invalidation through jobs and the store's internal route: the right shape for Next.js tag caching.
- Admin action logs: generic, and useful later for auditing agent-initiated changes.
- Request context through `AsyncLocalStorage`: standard for request IDs and error tagging.
- Localized JSON columns (see Decisions).

## Later

The Better Auth swap, the TanStack Start store on the dashboard's shadcn components (replacing tag invalidation jobs, `nextCache`, next-intl and the `next/image` loader), the search review, the commerce extensions (vendor features, variants, simulated shipping), payments with both Stripe and Paytrail selectable in the store, and AI features (rest-rpc contracts as agent tools, a dashboard agent, an MCP server for the store).

## Open Decisions

- Project name (`Acme` is a placeholder, one token to swap globally)
- Better Auth admin role: plugin or own column

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
6. **Integer cents**, on Prisma, so the Drizzle port only translates queries.
7. **Transactional route builders**, on Prisma: `customerTxRoute` / `dashboardTxRoute` replace `runAppTransaction` in handlers.
8. **Drizzle**, with pg-boss. Done; the queue is described in `job-queue.md`.

Deferred, not scheduled: Clerk → Better Auth, the TanStack Start store, the search documents review.

The sections below are input for these steps.

## Decisions

- **Money:** integer cents (minor units). Columns and API fields carry a `_cents` / `Cents` suffix; percentages (`vatRate`, `markupPercent`) are not money.
- **Localized content:** stays in JSON columns, resolved by `toResponse`. Query-level localization may replace that later, not now.
- **Job queue:** pg-boss.
- **Test runner:** Vitest with its default setup.
- **Checkout tips, UTM attribution, per-kg pricing, delivery fee model:** not core; removed.

## Tooling Refactors

Each is its own commit series on `main`.

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

### Job queue: replace with pg-boss (done)

`PersistentInMemoryJobQueue` stores jobs in the database but schedules them with in-process timers:

- It only works with exactly one backend process. Two instances would both hydrate and run the same pending jobs, because there are no leases or row locks.
- Jobs enqueued in a transaction are handed to the scheduler after commit (`jobQueue.schedule(jobIds)`). If the process dies in between, they wait for the next restart.
- Every pending job, including ones due days from now, holds a timer in memory.

Keep the good parts: the transactional enqueue (jobs are rows written in the same transaction as the change that caused them) and the typed job definitions (a Zod schema per job type). pg-boss claims jobs with `SKIP LOCKED`, is safe with several instances, and enqueues inside the caller's transaction, so the post-commit scheduling step disappears.

`docs/job-queue.md` gets rewritten with the swap.

### `runAppTransaction`: replaced by transactional builders (done)

Handlers no longer call it. A route that writes is built with `customerTxRoute` / `dashboardTxRoute`, whose middleware runs the whole handler in one transaction and provides it as `context.db`, with `context.enqueueJob` for jobs. `logAdminAction(db, entry)` is a plain helper. `AppContext.db` is typed as a transaction client, so handlers cannot open nested transactions.

What remains of `runAppTransaction` is plumbing: the builders' middleware, jobs, webhooks, and the few plain routes that must keep an external call outside a transaction (checkout payment creation, account deletion, and auth's user creation). Its only extra job is handing enqueued job ids to the in-memory queue after commit. With pg-boss that step disappears and it becomes `db.transaction`; the builders and `context.enqueueJob` stay. Done: `runAppTransaction` is gone, and code outside the builders calls `db.transaction` and `jobQueue.enqueue(tx, job)`.

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

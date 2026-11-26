# Roadmap

The project is a general commerce core: catalog, cart, checkout, orders, refunds, promotion codes, reviews, legal documents and admin, on contracts and data it owns. It doesn't take the usual route of assembling bought services. It moves to a simpler owned architecture on Bun and TanStack that runs with no mandatory configuration and no SaaS accounts, and makes it easy to add features off-the-shelf stacks don't give.

## Principles

- **Own the contract and the data; depend on libraries, not platforms.** Platforms that own the data model or the API (hosted auth, commerce engines, hosted CMS) get replaced or avoided. In-process libraries are fine.
- **One vertical slice at a time.** Each change ends with a green `pnpm check`.
- **No compatibility work.** Nothing is deployed, so schema changes go straight through and there is no data to migrate.

## Decisions

- **Money:** integer cents (minor units). Columns and API fields carry a `_cents` / `Cents` suffix; percentages (`vatRate`, `markupPercent`) are not money.
- **Localized content:** stays in JSON columns, resolved by `resolveLocalizedFields` where a response has them. Query-level localization may replace that later, not now.
- **Job queue:** pg-boss.
- **Test runner:** Vitest with its default setup.

## Better Auth

- Users move into the database. Better Auth's user table replaces `User.clerk_id` as the identity key, and most of the `AuthProvider` interface becomes plain queries.
- Better Auth's handler mounts as a plain Bun route at `/api/auth/*`, next to the webhooks. Add it to the AGENTS.md exceptions.
- Keep header-based auth with the bearer plugin, so the rest-rpc clients and the store's server-side client barely change.
- Store: the custom sign-in, sign-up and Google flows switch to Better Auth's client. Dashboard: a new login page and a replacement for Clerk's `UserProfile`.
- New owned flows: email verification and password reset (through the email integration), and the admin role (admin plugin or an own role column, replacing Clerk metadata in `grantAdmin`).

## Review Of Own Abstractions

Each of the repo's own abstractions has to earn its place in a general commerce core: keep it only if it's the design you'd recommend, not just one that works. The questions for each: does it solve a problem generic commerce actually has, would a library do it better, and does it hide complexity or only move it?

### `AuthProvider`: collapses with Better Auth (deferred)

The interface exists to wrap a remote identity service. After Better Auth, users are local rows, and most of it becomes plain queries.

### Product search documents: review (deferred)

Search keeps a separate `product_search_document` table per product and locale, maintained by `invalidateSearchIndex` jobs. Check whether a generated `tsvector` column (or a view) does the same job without the denormalized table and its sync jobs.

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

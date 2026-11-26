# Acme

A general commerce core (catalog, cart, checkout, orders, refunds, admin) built on contracts and data it owns, without a commerce platform, auth service or CMS underneath. It's meant to grow features off-the-shelf stacks don't give you out of the box. Which features those are is still open. `Acme` is a placeholder name.

## Why It Exists

- **A system-design example.** Commerce is a well-understood domain with real complexity: stock reservation, payment reconciliation, refunds, background jobs, cache invalidation. In production you'd usually buy much of it. Here it's built deliberately, and the docs say where you'd draw the line.
- **A proving ground for [rest-rpc](https://rest-rpc.vercel.app/llms.txt)**, the typed REST library the API is built on. The backend owns the routes, and both frontends call them through clients typed from the backend's routers.
- **An experiment in agent-driven development.** Owning a small set of primitives (a typed contract, the data model, in-process libraries instead of platforms) should make work predictable for people and agents alike: the typecheck says what a change broke, and one command verifies it.

## Status

Not deployed. The next steps, starting with running locally without any accounts, are in [docs/roadmap.md](docs/roadmap.md).

## Workspaces

- `apps/backend`: Bun API on rest-rpc, Drizzle and PostgreSQL, pg-boss jobs, Clerk auth, Stripe and Paytrail payments
- `apps/dashboard`: React 19 + Vite admin dashboard
- `apps/online-store`: Next.js storefront
- `packages/shared`: form schemas and pure utilities shared across apps

## Working With The Repo

```bash
pnpm install                   # also installs the Git hooks and extracts the API contract
docker compose up -d           # development and test databases
pnpm db:push                   # apply the Drizzle schema to the development database
pnpm seed                      # demo catalog (replaces catalog, orders and content)
pnpm dev                       # API on :3001, storefront on :3000, dashboard on Vite's port
pnpm check                     # format check, lint and typecheck: the same as CI
pnpm fix                       # format and apply autofixable lint fixes
```

Locally nothing needs an account: images are stored under `apps/backend/.local`, emails are printed to the backend console, and checkout offers a test payment provider. Signing in still needs Clerk keys until the auth swap. Each workspace's committed `.env.development` holds the local defaults; secrets and overrides go in `.env` (backend) or `.env.local` (frontends).

Add dependencies to the workspace that uses them: `pnpm --filter <workspace> add <package>`.

## Docs

- [AGENTS.md](AGENTS.md): architecture, conventions and workflow. The main reference for people and agents.
- [Development guidelines](docs/development-guidelines.md): tooling, commits, branches, database.
- Design notes: [checkout and payments](docs/checkout-payment-tradeoffs.md), [job queue](docs/job-queue.md), [admin action logs](docs/admin-action-logs.md), [safe token handling](docs/safe-token-handling.md), [storefront visibility](docs/storefront-visibility.md), [online store caching](docs/online-store-caching.md), [online store metadata](docs/online-store-metadata.md).

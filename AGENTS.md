# AGENTS.md

Last updated: 2026-11-22

## Project State And Direction

- The project is a general commerce core built on contracts and data it owns, meant to grow features off-the-shelf stacks don't give out of the box (still to be decided). `Acme` is a placeholder name. It also serves as a proving ground for rest-rpc and for agent-driven development. See `README.md`.
- Nothing is deployed. Backward compatibility is unnecessary unless the user explicitly asks for it. Prefer direct cleanup over compatibility layers, migration bridges, or preserving stale behavior.
- The plan is `docs/roadmap.md`. Parts it replaces (Next-only caching machinery, the in-memory job queue) shouldn't be extended.
- Prefer in-process libraries over platforms that own the data model or the API. Planned swaps: Prisma → Drizzle (with integer cents and pg-boss), later Clerk → Better Auth.
- Payments: the backend supports Stripe and Paytrail through one provider interface; the online store currently implements only the Paytrail flow.

## Architecture Posture

The API is server-first, built with [rest-rpc](https://rest-rpc.vercel.app/llms.txt). The backend owns the routes, and the frontends call them through clients built from an extracted contract. Bring this up when it is relevant to the task, especially when changing backend API behavior, frontend API usage, request/response shapes, auth requirements, errors, or localization behavior.

- Routes live in `apps/backend/src/features/<api>/<feature>/<feature>.routes.ts`, built with `customerRoute` / `dashboardRoute` from `src/routing/base.ts`. The handler is the implementation: there is no service layer. Single-use logic stays inline. Logic shared by several handlers, jobs or webhooks, or that names a real domain concept (pricing, stock reservation), becomes a helper next to the feature that takes its dependencies as arguments.
- Response types are inferred from handlers. Every JSON handler returns `toResponse(value, context.locale)` (`src/routing/toResponse.ts`), which converts Decimal to `number`, Date to an ISO string and localized objects to the requested locale, and types the result as what JSON delivers. Handlers that return nothing or a binary `respond(...)` are the exceptions.
- Auth is route metadata: `.meta({ access: "ADMIN" })`. The base builder's middleware enforces it and provides `context.authContext` and `context.locale`.
- Dependencies come through context (`AppContext` in `src/routing/base.ts`): `db`, `config`, `auth`, `payments`, `email`, `storage`, `search`, `jobQueue`, `runAppTransaction`. `index.ts` constructs them and passes them as the `createApp` context.
- Transactions are a choice of builder. Handlers that write more than once, enqueue jobs or log admin actions use `customerTxRoute` / `dashboardTxRoute`: the whole handler runs in one transaction, `context.db` is that transaction and `context.enqueueJob(...)` enqueues jobs that become visible on commit. Log admin actions with `logAdminAction(context.db, {...})`. The plain builders are for reads, single-statement writes, and handlers that call external services (checkout payment creation, account deletion), which must not hold a transaction open; those open explicit ones with `context.runAppTransaction`. Jobs and webhooks, which are not routes, use `runAppTransaction` directly.
- Route modules must be side-effect free at import time, because contract extraction (`pnpm --filter backend contract`, run with `NODE_ENV=production` and no secrets) imports them. They may import at runtime only `@rest-rpc/*`, `zod`, `@acme/shared`, `logger.ts`, `@prisma/client/runtime/client` and other side-effect-free helpers. `config.ts`, `prisma.ts`, integration providers and the generated Prisma client are `import type` only; use `context.*` instead. Jobs and payment webhook routers are not imported by route modules and may import them directly.
- Expected business failures are `routeError("CODE", { status, data? })` definitions in `<feature>.errors.ts` (shared ones in `src/routing/errors.ts`), declared on every route that can throw them with `.error(Def)`, including errors thrown from helpers. Use a plain `RouteError` only for developer-facing failures.
- Rate limits are route metadata: `.meta({ rateLimit: { name, windowMs, max } })`, enforced by an interceptor in `src/routing/rateLimit.ts`.
- Frontends call routes through the rest-rpc clients: the dashboard through `queryUtils` from `context/ApiClientContext.tsx`, the store through `useApiClient()` in client components and `createServerSideApiClient()` in server code. Response types come from `InferClientResponse`, not hand-written types. Wire data is plain JSON: dates are ISO strings, so call `new Date(value)` where a `Date` is needed.
- Server inference widens string literals in returned objects. Annotate the `const` with its union where a client switches on it.
- Use `z.coerce.number<number>()` / `z.coerce.date<Date>()` for params, query and headers, never bare `z.coerce.*`, and `z.stringbool()` for booleans (`z.coerce.boolean()` turns `"false"` into `true`).
- Form schemas the dashboard also uses live in `packages/shared/schemas/`. Schemas used only by the backend live in the route module.

## Repo Shape

This is a `pnpm` monorepo with these main workspaces:

- `apps/backend` - Bun (fetch-standard) API, Prisma/Postgres, Clerk, Paytrail, Stripe, and other core backend services
- `apps/dashboard` - React 19 + Vite admin/dashboard app
- `apps/online-store` - Next.js customer-facing web storefront
- `packages/shared` - form schemas the dashboard uses, and pure utilities shared across apps (pricing, slugify, cache tags, phone validation)

Workspace names should match filesystem directory names. When running scripts, assume the `pnpm --filter` name is the physical directory name, for example `backend`, `dashboard`, or `online-store`. Use scoped package names only where the package actually uses one, such as `@acme/shared`.

Because this is a pnpm monorepo, workspace packages are symlinked. Do not assume package files will appear in the same physical `node_modules` layout used by npm or yarn classic installs.

## Default Workflow

For normal API/product work:

1. Add or change the route in `apps/backend/src/features/**/*.routes.ts`, with its errors in the feature's `*.errors.ts`.
2. Register a new route tree in `apps/backend/src/routes.ts`.
3. Consume it through `queryUtils` / the client in dashboard or online-store. Their types follow the router, so typecheck them.

For non-API work, do the smallest direct change that satisfies the request. Do not force API architecture discussion into unrelated questions.

Do not hand-write parallel types or ad hoc fetch wrappers unless there is a strong reason.

## Database Workflow

- The project currently does not use Prisma migrations.
- Database schema changes are handled with `prisma db push`; the user will run this when needed.
- Prisma client/schema generation is handled with `prisma generate`.
- Agents can try generation if it is directly useful, but if it fails in the agent environment, capture the error and move on instead of spending a long time fighting it. The user is ready to fix generation locally.
- If `prisma generate` fails, note whether the failure looks like sandbox permissions, pnpm symlink resolution, missing generated directories, or another concrete cause so it can be traced later.

## Commands And Permissions

- Prefer workspace-scoped commands such as `pnpm --filter <workspace> ...`.
- After changing code, run `pnpm check` from the repo root (format check, lint, typecheck; the same as CI). `pnpm fix` applies formatting and autofixable lint fixes. `pnpm typecheck` alone typechecks every workspace in a few seconds.
- Run tests when they verify the work at hand, scoped to it: the unit or integration tests covering the code you changed. Don't run the full suite, or integration tests, for changes they don't exercise (UI wiring, copy, styling). Broad refactors of backend behavior (ORM, queue, transactions) do warrant the full integration suite.
- Backend has separate unit and integration test suites. Integration tests need the Docker Compose test database running with the latest schema state and may require elevated permissions.
- Some tests and commands require elevated permissions. Do not work around sandbox restrictions by changing the command or skipping the requested check. Ask for permission when the intended command needs it.
- Do not spend time formatting code by hand. `pnpm fix` and the pre-commit hook format automatically. Typecheck matters more.
- Tooling: oxfmt (`.oxfmtrc.json`), oxlint with type-aware rules (`.oxlintrc.json`), TypeScript 7 with one shared `tsconfig.base.json` that every workspace extends. Typecheck never emits. The online store's typecheck needs `apps/backend/generated/contracts/customer.json`, which the backend `postinstall` generates.

## Coding Standards

- Apply KISS by default unless there is a clear, concrete reason not to.
- Start with the simplest implementation that fits the current requirements.
- When in doubt, choose the more direct implementation.
- Do not optimize for hypothetical future needs.
- Prefer local clarity, obvious data flow, and keeping related logic together.
- Abstraction must earn its existence. Only introduce indirection when it removes real complexity, reduces meaningful duplication, or names a real domain concept.
- Keep logic inline when it is single-purpose, used once, and easier to understand in place.
- Start extracting or splitting when there is repeated logic, multiple responsibilities, independently changing sections, or a real domain concept that becomes clearer as a named unit.
- Write modern JavaScript/TypeScript using current language idioms. Do not write legacy-style code unless there is a strong reason.
- Do not use `any` or `unknown` without strong reason. Any bypass of the type system should be justified and documented in a code comment when it is not obvious.
- Match the existing style of the file you are editing.
- Do not comment self-explanatory code. Comments should explain why something is done a certain way or provide context that is not obvious from the code.

## Organization

- Organize new code by feature/domain. Avoid dumping code into technical-layer or general utility folders unless it is genuinely shared infrastructure. The codebase already violates this in places; do not expand that pattern.
- For online-store changes, keep meaningful feature logic out of Next.js page files even where existing files have drifted that way.
- Use import aliases for workspace imports. Never use relative imports across workspaces. For example, use `import { ... } from "@acme/shared/..."` instead of importing through `../../packages/shared/...`.
- Within a workspace, prefer local path aliases if they already exist, such as `@/components` or `@/features`.
- The backend uses package.json subpath imports instead: `#src/*` maps to `apps/backend/src/*` and works in Bun, Node, TypeScript and the dashboard's build-time contract macro. Use it instead of `../` imports; same-directory `./` imports stay relative.

## API-Specific Rules

- Keep business logic in route handlers and feature helpers, not in server plumbing. Do not add hand-written fetch routes for normal API features; webhooks are the only plain routes, added to the Bun routes in `index.ts`.
- Do not create response types by hand when the router already infers them. Use `InferClientResponse` on the client.
- Do not bypass the rest-rpc clients with custom fetch code unless absolutely necessary.
- Use domain errors (`routeError`) only when the frontend is expected to handle the failure as a normal part of the user experience. Do not treat developer errors as domain errors: if frontend UI should reasonably prevent an error, it is not one.
- Do not manually localize translatable JSON unless there is a specific reason; `toResponse` does it.

## Scope Control

- Do not fix unrelated issues if they do not affect the current feature.
- Issues should be fixed when encountered as part of normal work, but do not start broad cleanup without explicit confirmation.
- Improvements should be discussed and confirmed separately from feature work unless they are necessary to ship the requested change.
- Do not add structure whose main benefit is aesthetic rather than practical.
- Do not create abstractions just because they feel cleaner, more modular, or more future-proof in theory.

## Important Notes

- The typecheck is clean and the pre-commit hook enforces it. Keep it that way.
- Type errors appearing outside the app's own code can be a sandboxing or generated-artifact issue and may be false positives. Examples that have occurred include `.next` generated types and library type errors that do not affect this repo's source.

## Read More On Demand

For deeper context, read only what you need:

- Plan: `docs/roadmap.md`
- Design notes: `docs/*.md` (checkout and payments, job queue, admin action logs, token handling, storefront visibility, online store caching and metadata)
- Backend route builders and context: `apps/backend/src/routing/base.ts`
- Route registration: `apps/backend/src/routes.ts`
- Backend server wiring: `apps/backend/src/index.ts`
- Reference route modules: `features/customer-api/products/products.routes.ts`, `features/dashboard-api/categories/categories.routes.ts`
- Dashboard CRUD shell: `apps/dashboard/src/components/ui/entity-page.tsx`

If you only remember one thing:

Keep the change small, current-state-oriented, and aligned with the files already involved.

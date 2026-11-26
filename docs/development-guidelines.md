# Development Guidelines

How work is done in this repo. The project isn't deployed, so backward compatibility is never a default requirement: prefer direct schema and code cleanup.

## Formatting, Linting And Typechecking

- Formatting: [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (`.oxfmtrc.json`), with its defaults plus import sorting and Tailwind class sorting in the dashboard.
- Linting: [oxlint](https://oxc.rs/docs/guide/usage/linter) (`.oxlintrc.json`), with type-aware rules.
- Typechecking: TypeScript 7. Every workspace `tsconfig.json` extends the root `tsconfig.base.json`, which holds the shared strict options. Typecheck never emits or builds anything.

The committed `.vscode/` settings format and fix on save. Install the recommended extensions when VS Code asks (oxc and TypeScript 7).

Lefthook installs its Git hooks from its own install script on `pnpm install`. Before each commit it runs `oxlint --fix` and `oxfmt` on staged files, stages what they fix, and then runs the typecheck. Warnings never block a commit.

Root commands:

```bash
pnpm check      # format check + lint + typecheck, the same as CI
pnpm fix        # format + autofixable lint fixes
pnpm typecheck  # typecheck every workspace
```

`oxlint` and `oxfmt` also take paths, for example `pnpm oxlint --fix apps/online-store/src/path/to/file.tsx`.

CI (`.github/workflows/ci.yml`) runs `pnpm check` and the unit tests. Integration tests are not in CI yet because they need a database.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

- `feat`: a new feature or user-facing capability
- `fix`: a bug fix
- `style`: formatting or visual UI changes
- `refactor`: restructuring without changing behavior
- `chore`: tooling, configuration and other maintenance
- `docs`: documentation
- `test`: tests

Examples:

```text
feat(checkout): add Stripe payment element
fix(auth): preserve reset code after password validation error
refactor(checkout): simplify order summary rendering
chore: update dependencies
```

## Branches

Name branches `type/short-description`, lowercase with hyphens, using the same types as commits:

```text
feat/stripe-checkout
refactor/drizzle
chore/tooling-update
```

## Database

The backend uses PostgreSQL through Drizzle, selected with `DATABASE_URL`. There are no migrations: schema changes are applied with `drizzle-kit push` (`pnpm db:push`). Search needs the `pg_trgm` extension, which `db:push` does not create.

`compose.yaml` in the repo root runs two local databases:

- development: `postgresql://postgres:postgres@localhost:5432/acme_dev`
- test, used by the backend integration tests: `postgresql://postgres:postgres@localhost:5433/acme_test`

Backend tests run on Vitest (`pnpm --filter backend test:unit` / `test:integration`); scripts run on Bun. Integration tests need the test database running with the current schema (`pnpm --filter backend test:db:init`). In sandboxed agent environments they may need elevated permissions.

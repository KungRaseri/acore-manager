---
name: database-workflow
description: Use when changing the Drizzle schema, generating or applying migrations, regenerating the Better Auth tables, or debugging DATABASE_URL and MySQL connection issues.
---

# Database Workflow

## When to use

- Adding, altering, or removing tables or columns in the project schema.
- Generating or applying migrations.
- Debugging `DATABASE_URL` or `.env` problems.
- Regenerating the Better Auth tables after an upgrade or config change.

## When NOT to use

- Auth feature work that does not touch the schema — use `auth-setup`.
- Query and UI work that does not change table definitions — use `sveltekit-development`.

## References

- [`llms/drizzle/llms.txt`](../../../llms/drizzle/llms.txt) — Drizzle ORM + drizzle-kit docs:
  - Getting started: **use the MySQL sections** (this project is MySQL, not PostgreSQL)
  - Schema declaration: the `mysql/sql-schema-declaration` section — what `schema.ts` follows
  - Relations: the MySQL relations section
  - Queries + CRUD: `Drizzle Queries + CRUD`
  - Migrations: `Migrations` → `drizzle-kit generate` / `migrate` / `push` / `pull`, `Drizzle Kit configuration file`
- [`AGENTS.md`](../../../AGENTS.md) → Database workflow, Environment & setup.
- [`src/lib/server/db/schema.ts`](../../../src/lib/server/db/schema.ts) — **schema source of truth**.
- [`src/lib/server/db/auth.schema.ts`](../../../src/lib/server/db/auth.schema.ts) — **generated** Better Auth tables.
- [`src/lib/server/db/index.ts`](../../../src/lib/server/db/index.ts) — the Drizzle client.
- [`drizzle.config.ts`](../../../drizzle.config.ts) — schema path, `dialect: 'mysql'`, `strict: true`, reads `DATABASE_URL`.

## Key facts

- **The database is MySQL** (`mysql2` driver, `dialect: 'mysql'`). Drizzle's PostgreSQL guidance does not apply — read the MySQL sections of the corpus.
- `drizzle.config.ts` points at `src/lib/server/db/schema.ts`. `drizzle-kit` writes migrations to its default output directory (`drizzle/`) — the config does not override `out`.
- `schema.ts` is the source of truth; `auth.schema.ts` is **generated output** and must not be edited by hand.
- There is **one `.env` at the repository root** — not per-workspace env files.
- **Drizzle does not create the database.** [`migrate.mjs`](../../../migrate.mjs) does: it runs
  `CREATE DATABASE IF NOT EXISTS` (utf8mb4) and only then `drizzle-orm/mysql2/migrator`. The container
  entrypoint runs it on every start, and both steps are idempotent.
- The database client must be constructed lazily so `vite build` never needs a live database.

## Steps

1. Edit [`src/lib/server/db/schema.ts`](../../../src/lib/server/db/schema.ts). Consult the MySQL schema-declaration section of `llms/drizzle/llms.txt` for table and column syntax.
2. If the change involves the auth tables, regenerate them first: `npm run auth:schema`.
3. Generate a migration: `npm run db:generate`.
4. Apply it: `npm run db:migrate`. While iterating locally, `npm run db:push` syncs the schema directly.
5. Inspect data or structure with `npm run db:studio`.
6. If `DATABASE_URL` errors, confirm it is set in `.env` at the repository root and uses the
   `mysql://user:password@host:port/database` form.

## Rules

- Keep the schema driver-agnostic within Drizzle's MySQL module — do not import `mysql2` (or any
  driver) into schema files; the driver belongs to the client.
- Keep the DB client lazily constructed via `getDb()`; never build it at module scope.
- Never commit `.env`; keep `.env.example` in sync when a variable is added.
- Commit generated migrations alongside the schema change, and update `AGENTS.md` if the workflow changes.
- Do not add tables for features that are not designed yet. In particular, there is **no AzerothCore
  integration schema** — that work is deferred and must be designed (including its security rules)
  before tables are added.

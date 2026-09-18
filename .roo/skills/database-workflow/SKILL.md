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
- **AzerothCore's databases are not ours.** `acore_auth`, `acore_world`, `acore_characters` (and
  `acore_playerbots`) are owned and migrated by AzerothCore, whose SQL updater applies
  `data/sql/updates/`. Reach them through the plain `mysql2` pools in
  [`src/lib/server/db/acore.ts`](../../../src/lib/server/db/acore.ts) — `getAcoreAuthDb()`,
  `getAcoreWorldDb()`, `getAcoreCharactersDb()`, or `getAcoreDb(name)` for any name in
  `ACORE_DATABASES`. They are configured by a single `ACORE_DATABASE_URL` (server and credentials
  only; the database name is chosen per client).
- **Never point `drizzle-kit` at an AzerothCore database**, and never declare its tables in a Drizzle
  schema. You would only ever declare a subset of a schema this large, and `db:push` would then try to
  drop everything it was not told about.
- **`acore_auth.account` is read, never written.** Game accounts are created by the worldserver through
  its own console command (`src/lib/server/accounts/service.ts`), and linking only _reads_ the `salt` and
  `verifier` columns to check a password against them. There is deliberately no Drizzle schema for it.
- **`game_account` maps a `user` row to a game account name** (unique on that name; see
  [`.roo/skills/auth-setup`](../auth-setup/SKILL.md) for the generated auth tables). It is migrated in
  `drizzle/0001_awesome_tombstone.sql`, and it cascades from `user` because it stores data that belongs to
  the profile.
- **`command_audit` is the append-only record of every console command attempt** — the intent, the outcome
  and the refusals (see [`AGENTS.md`](../../../AGENTS.md) → GM command console & audit trail). Migrated in
  `drizzle/0002_quick_jack_murdock.sql`. Two things in it are deliberate: `user_id` has **no foreign key to
  `user`** — a cascade would erase the history of a deleted profile, and the record is not the profile's to
  delete, so do not "fix" it — and `status` / `failure_reason` are varchars rather than enums, because the
  reasons follow the SOAP client's failure vocabulary. Nothing prunes the table, and no page edits or
  deletes a row.
- The database client must be constructed lazily so `vite build` never needs a live database.

## Steps

1. Edit [`src/lib/server/db/schema.ts`](../../../src/lib/server/db/schema.ts). Consult the MySQL schema-declaration section of `llms/drizzle/llms.txt` for table and column syntax.
2. If the change involves the auth tables, regenerate them first: `npm run auth:schema`.
3. **Stop here and hand the CLI to the human.** The repository owner runs `npm run db:generate` (and
   `db:migrate` / `db:push`) themselves, so an agent must not invoke them: make the schema change and
   report plainly that a migration is still pending. A schema change without a generated migration
   fails at runtime, not at build time — the container applies only what is in `drizzle/`.
4. The human generates `drizzle/NNNN_*.sql` plus `drizzle/meta/*`, then applies it with
   `npm run db:migrate` (or `db:push` while iterating locally) against a live MySQL.
5. Inspect data or structure with `npm run db:studio` — again the human's call, since it needs the same
   live database.
6. If `DATABASE_URL` errors, confirm it is set in `.env` at the repository root and uses the
   `mysql://user:password@host:port/database` form.

## Rules

- **Never run the Drizzle CLI yourself.** `db:generate`, `db:migrate`, `db:push` and `db:studio` are
  the repository owner's commands; an agent edits `schema.ts` and says a migration is pending. Asking
  wastes a turn — the request is declined by design.
- Keep the schema driver-agnostic within Drizzle's MySQL module — do not import `mysql2` (or any
  driver) into schema files; the driver belongs to the client.
- Keep the DB client lazily constructed via `getDb()`; never build it at module scope.
- Never commit `.env`; keep `.env.example` in sync when a variable is added.
- Commit generated migrations alongside the schema change, and update `AGENTS.md` if the workflow changes.
- Do not add tables for features that are not designed yet. `game_account` exists because the design was
  settled first — create through the console, then link by verifying the credentials already stored on
  the server — and `command_audit` arrived the same way, with the design note that fixed the console's
  execution order and its two-phase write. The next integration table should be justified the same way,
  security rules included.

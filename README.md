# acore-manager

A server and player management website for AzerothCore (World of Warcraft 3.3.5a) servers.

> **Status: early scaffolding, with the plumbing in place.** Sign-in (Discord), the database
> bootstrap and the container build all work. The remaining routes under `src/routes/demo/**` and the
> helpers under `src/lib/vitest-examples/**` are scaffold demos, not product features. The AzerothCore
> integration layer has not been built yet — see [Roadmap](#roadmap).

## Stack

| Concern     | Choice                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework   | SvelteKit 2 + Svelte 5 (runes mode forced in `vite.config.ts`)                                                       |
| Language    | TypeScript, strict, ESM (`"type": "module"`)                                                                         |
| Styling     | Tailwind CSS 4 (CSS-first, no `tailwind.config.js`)                                                                  |
| UI          | Skeleton v5 + Bits UI (headless primitives) + Lucide icons + Simple Icons brand marks — **installed, not yet wired** |
| Database    | MySQL via Drizzle ORM + drizzle-kit (`mysql2` driver)                                                                |
| Auth        | Better Auth — Discord OAuth, email/password disabled                                                                 |
| Build       | Vite 7                                                                                                               |
| Test        | Vitest 3 (`client` project on jsdom + `server` node project, via `@testing-library/svelte`) + Playwright (e2e only)  |
| Lint/format | ESLint (flat config) + Prettier (tabs, `printWidth` 100, Svelte + Tailwind plugins)                                  |

## Requirements

- **Node.js 20.19+ or 22.13+** (or 24+). `.npmrc` sets `engine-strict=true` and the lockfile's
  transitive dependencies reject older releases. Verified on Node 22.22.3 / npm 10.9.8.
- **MySQL 8.x** for the manager's own database.
- An AzerothCore server to manage (auth server on `3724`, world server on `8085`) is required for
  the integration work, not for building or testing the website itself.

## Getting started

```bash
npm install
```

Copy the environment template and fill it in:

```bash
copy .env.example .env     # Windows (cp .env.example .env elsewhere)
```

Then start the dev server:

```bash
npm run dev
# or open a browser automatically
npm run dev -- --open
```

## Environment

`.env` is git-ignored (`.gitignore` ignores `.env` and `.env.*` but keeps `!.env.example`) — never
commit it. Generate your own `BETTER_AUTH_SECRET` rather than using a placeholder:

| Variable                | Purpose                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | MySQL connection string, `mysql://user:password@host:port/database`                                                             |
| `ORIGIN`                | Site origin used by SvelteKit/Better Auth (e.g. `http://localhost:5173` dev, `http://localhost:4173` preview)                   |
| `BETTER_AUTH_SECRET`    | Better Auth signing secret — use 32+ characters of high entropy, and a different value per environment                          |
| `DISCORD_CLIENT_ID`     | Discord OAuth application id — create one at [discord.com/developers/applications](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_SECRET` | Discord OAuth application secret                                                                                                |
| `ACORE_DATABASE_URL`    | AzerothCore's MySQL server and credentials — **no database in the URL**, since the database name is chosen per client           |

## Scripts

| Script                | Does                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                                           |
| `npm run build`       | Production build                                                          |
| `npm run preview`     | Serve the production build (port 4173)                                    |
| `npm run check`       | `svelte-kit sync` + `svelte-check` — **the typecheck gate**               |
| `npm run lint`        | `prettier --check .` then `eslint .`                                      |
| `npm run format`      | `prettier --write .`                                                      |
| `npm run test:unit`   | Vitest (watch mode) — use `-- --run` for a single pass                    |
| `npm run test`        | Unit tests plus e2e                                                       |
| `npm run test:e2e`    | `playwright install` then `playwright test`                               |
| `npm run db:push`     | Drizzle schema push (dev-time sync)                                       |
| `npm run db:generate` | Generate migrations                                                       |
| `npm run db:migrate`  | Apply migrations                                                          |
| `npm run db:studio`   | Drizzle Studio                                                            |
| `npm run auth:schema` | Regenerate the Better Auth tables into `src/lib/server/db/auth.schema.ts` |

There is no `typecheck` or `coverage` script — `npm run check` is the type gate, and coverage is not
gated. Note that `test:unit` runs Vitest in watch mode, so CI and one-shot runs must pass `-- --run`.

## Project layout

| Path                     | Role                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/routes/`            | SvelteKit routes — pages, `+page.server.ts` loads and actions                                         |
| `src/routes/layout.css`  | Tailwind 4 entry point (also the stylesheet Prettier uses for Tailwind class sorting)                 |
| `src/hooks.server.ts`    | SvelteKit server hooks (Better Auth session handling)                                                 |
| `src/lib/server/auth.ts` | Better Auth instance — `getAuth()`, server-only, built lazily                                         |
| `src/lib/server/db/`     | `index.ts` (`getDb()`), `schema.ts` (project schema), `auth.schema.ts` (generated Better Auth tables) |
| `migrate.mjs`            | Creates the database if missing, then applies migrations                                              |
| `Dockerfile`             | Container image build (see [Deployment](#deployment))                                                 |
| `src/lib/assets/`        | Assets imported by components                                                                         |
| `src/app.html`           | HTML shell (where a Skeleton `data-theme` attribute goes)                                             |
| `static/`                | Served as-is from the site root                                                                       |
| `.roo/skills/`           | Reusable agent skills — catalog in [`.roo/skills/README.md`](.roo/skills/README.md)                   |
| `llms/`                  | Third-party reference corpora (`llms.txt`) — provenance in [`llms/README.md`](llms/README.md)         |
| `.github/workflows/`     | CI                                                                                                    |
| `AGENTS.md`              | Authoritative reference for agents and humans working here                                            |

## Database and auth

- The schema lives in `src/lib/server/db/schema.ts` and is the source of truth. `drizzle.config.ts`
  points at it, reads `DATABASE_URL`, and uses the `mysql` dialect.
- `src/lib/server/db/auth.schema.ts` is **generated** — regenerate it with `npm run auth:schema`
  after changing the Better Auth config, and never hand-edit it.
- Edit the schema → `npm run db:generate` → `npm run db:migrate` (or `db:push` while developing).
- Sign-in is **Discord only** — `src/routes/login/` starts the OAuth flow. Add
  `<ORIGIN>/api/auth/callback/discord` as a redirect URI on the Discord application.
- Keep database and auth construction lazy (`getDb()` / `getAuth()` build on first use, never at
  module scope) so that `vite build` — including SvelteKit's post-build analysis — does not need a
  live database. This is what lets the container image build without any secrets.
- **Drizzle does not create the database.** Creating it is a separate one-time bootstrap handled by
  `migrate.mjs`; `drizzle-kit migrate` alone fails against a database that does not exist yet.
- **AzerothCore's databases are read through plain clients, not Drizzle.** `acore_auth`,
  `acore_world` and `acore_characters` are owned and migrated by AzerothCore, so
  `src/lib/server/db/acore.ts` exposes `mysql2` pools (`getAcoreAuthDb()`, `getAcoreWorldDb()`,
  `getAcoreCharactersDb()`) with no schema and no migrations. Add the database name to
  `ACORE_DATABASES` when you need another, and set `ACORE_DATABASE_URL` in `.env`.

## UI foundation

Skeleton v5, Bits UI, Lucide and Simple Icons are installed but the global stylesheet has not been
wired up yet. The planned arrangement is:

- `src/routes/layout.css` imports Tailwind, the Skeleton core stylesheet, and one Skeleton theme.
- A theme is activated with `data-theme="<name>"` on the `<html>` element in `src/app.html`.
- Skeleton ships 24 built-in themes; `pine` is the placeholder carried over from the previous
  project and may be replaced. No theme has been chosen for this project yet.

See [`.roo/skills/ui-development/SKILL.md`](.roo/skills/ui-development/SKILL.md) and the
[`llms/skeletondev/`](llms/skeletondev) reference for the full component and token inventory.

## Deployment

The app is deployed as a container, built from the repository root:

```bash
docker build -t acore-manager .
```

`@sveltejs/adapter-node` produces `build/`, and `docker-entrypoint.sh` bootstraps the database before
starting the server:

```bash
node migrate.mjs      # create the database if needed, then apply migrations
node build/index.js   # serve (PORT, default 3000)
```

The same two commands work outside Docker — that is exactly what the container runs.

- `migrate.mjs` creates the database (`CREATE DATABASE IF NOT EXISTS`, utf8mb4) **before** running
  Drizzle's migrator, retries while the database is still starting, and both steps are idempotent, so
  restarts are no-ops.
- Runtime environment: `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET`. **`ORIGIN` must be the browser-facing origin**, or adapter-node rejects
  cross-origin form submissions.
- The image build needs no database and no secrets.

## Roadmap

1. **Finish cleaning the scaffold** — remove the remaining `/demo` routes and `src/lib/vitest-examples/**`,
   wire up Tailwind + Skeleton, and replace the placeholder theme.
2. **Define the management domain** — accounts, GM levels, characters, bans, live operations.
3. **AzerothCore integration** — deliberately deferred. Before any of it is built, document the
   integration surfaces (the shared `acore_auth`/`acore_world`/`acore_characters` databases, the
   world server's SOAP console, and offline SRP6 account provisioning) and the security rules that
   go with them.

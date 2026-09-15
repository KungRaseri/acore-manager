# acore-manager

A server and player management website for AzerothCore (World of Warcraft 3.3.5a) servers.

> **Status: early scaffolding.** This project is a recent `sv create` scaffold. The auth and
> database foundations are in place, but the routes under `src/routes/demo/**` and the helpers
> under `src/lib/vitest-examples/**` are scaffold demos, not product features. The AzerothCore
> integration layer has not been built yet — see [Roadmap](#roadmap).

## Stack

| Concern     | Choice                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework   | SvelteKit 2 + Svelte 5 (runes mode forced in `vite.config.ts`)                                                       |
| Language    | TypeScript, strict, ESM (`"type": "module"`)                                                                         |
| Styling     | Tailwind CSS 4 (CSS-first, no `tailwind.config.js`)                                                                  |
| UI          | Skeleton v5 + Bits UI (headless primitives) + Lucide icons + Simple Icons brand marks — **installed, not yet wired** |
| Database    | MySQL via Drizzle ORM + drizzle-kit (`mysql2` driver)                                                                |
| Auth        | Better Auth                                                                                                          |
| Build       | Vite 8                                                                                                               |
| Test        | Vitest 4 (browser + node projects) + Playwright (e2e)                                                                |
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

| Variable             | Purpose                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | MySQL connection string, `mysql://user:password@host:port/database`                                           |
| `ORIGIN`             | Site origin used by SvelteKit/Better Auth (e.g. `http://localhost:5173` dev, `http://localhost:4173` preview) |
| `BETTER_AUTH_SECRET` | Better Auth signing secret — use 32+ characters of high entropy, and a different value per environment        |

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

| Path                     | Role                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/routes/`            | SvelteKit routes — pages, `+page.server.ts` loads and actions                                              |
| `src/routes/layout.css`  | Tailwind 4 entry point (also the stylesheet Prettier uses for Tailwind class sorting)                      |
| `src/hooks.server.ts`    | SvelteKit server hooks (Better Auth session handling)                                                      |
| `src/lib/server/auth.ts` | Better Auth instance (server-only)                                                                         |
| `src/lib/server/db/`     | `index.ts` (Drizzle client), `schema.ts` (project schema), `auth.schema.ts` (generated Better Auth tables) |
| `src/lib/assets/`        | Assets imported by components                                                                              |
| `src/app.html`           | HTML shell (where a Skeleton `data-theme` attribute goes)                                                  |
| `static/`                | Served as-is from the site root                                                                            |
| `.roo/skills/`           | Reusable agent skills — catalog in [`.roo/skills/README.md`](.roo/skills/README.md)                        |
| `llms/`                  | Third-party reference corpora (`llms.txt`) — provenance in [`llms/README.md`](llms/README.md)              |
| `.github/workflows/`     | CI                                                                                                         |
| `AGENTS.md`              | Authoritative reference for agents and humans working here                                                 |

## Database and auth

- The schema lives in `src/lib/server/db/schema.ts` and is the source of truth. `drizzle.config.ts`
  points at it, reads `DATABASE_URL`, and uses the `mysql` dialect.
- `src/lib/server/db/auth.schema.ts` is **generated** — regenerate it with `npm run auth:schema`
  after changing the Better Auth config, and never hand-edit it.
- Edit the schema → `npm run db:generate` → `npm run db:migrate` (or `db:push` while developing).
- Keep database and auth construction lazy (build them on first use, not at module scope) so that
  `vite build` — including SvelteKit's post-build analysis — does not need a live database.

## UI foundation

Skeleton v5, Bits UI, Lucide and Simple Icons are installed but the global stylesheet has not been
wired up yet. The planned arrangement is:

- `src/routes/layout.css` imports Tailwind, the Skeleton core stylesheet, and one Skeleton theme.
- A theme is activated with `data-theme="<name>"` on the `<html>` element in `src/app.html`.
- Skeleton ships 24 built-in themes; `pine` is the placeholder carried over from the previous
  project and may be replaced. No theme has been chosen for this project yet.

See [`.roo/skills/ui-development/SKILL.md`](.roo/skills/ui-development/SKILL.md) and the
[`llms/skeletondev/`](llms/skeletondev) reference for the full component and token inventory.

## Roadmap

1. **Clean up the scaffold** — remove the `src/routes/demo/**` pages and `src/lib/vitest-examples/**`,
   wire up Tailwind + Skeleton, and replace the placeholder theme.
2. **Define the management domain** — accounts, GM levels, characters, bans, live operations.
3. **AzerothCore integration** — deliberately deferred. Before any of it is built, document the
   integration surfaces (the shared `acore_auth`/`acore_world`/`acore_characters` databases, the
   world server's SOAP console, and offline SRP6 account provisioning) and the security rules that
   go with them.

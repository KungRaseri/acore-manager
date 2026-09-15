# AGENTS.md — acore-manager

Reference document for AI agents (and humans) working in this repository. This is a reference, not a tutorial.

## Project overview

acore-manager is a **server and player management website for AzerothCore** (World of Warcraft 3.3.5a) servers. It is a **single SvelteKit application** — not a monorepo and not a workspace layout.

- Application code lives in [`src/`](src) (routes under [`src/routes/`](src/routes), server-only code under [`src/lib/server/`](src/lib/server)).
- Reusable **agent skills** live in [`.roo/skills/`](.roo/skills) and their third-party `llms.txt` reference corpus in [`llms/`](llms) — see [Skills & reference material](#skills--reference-material).
- **Status: early scaffolding.** This is a recent `sv create` scaffold. Auth and database foundations exist; the demo routes and test examples are placeholders — see [Scaffold placeholders to replace](#scaffold-placeholders-to-replace).
- **The AzerothCore integration layer does not exist yet and is deliberately deferred.** Nothing in this document describes it beyond the roadmap entry, so do not assume any integration surface is available. Read [Roadmap](#roadmap) before starting integration work.

## Repository layout

| Path                                                                   | Role                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`src/routes/`](src/routes)                                            | SvelteKit routes — pages, `+page.server.ts` loads and actions                              |
| [`src/routes/layout.css`](src/routes/layout.css)                       | Tailwind 4 entry point; also the stylesheet Prettier uses for Tailwind class sorting       |
| [`src/hooks.server.ts`](src/hooks.server.ts)                           | SvelteKit server hooks                                                                     |
| [`src/app.html`](src/app.html)                                         | HTML shell; where a Skeleton `data-theme` attribute belongs                                |
| [`src/app.d.ts`](src/app.d.ts)                                         | SvelteKit ambient types (`App.Locals`, …)                                                  |
| [`src/lib/server/auth.ts`](src/lib/server/auth.ts)                     | Better Auth instance (server-only)                                                         |
| [`src/lib/server/db/index.ts`](src/lib/server/db/index.ts)             | Drizzle client                                                                             |
| [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts)           | **Schema source of truth**                                                                 |
| [`src/lib/server/db/auth.schema.ts`](src/lib/server/db/auth.schema.ts) | **Generated** Better Auth tables — never hand-edit                                         |
| [`src/lib/assets/`](src/lib/assets)                                    | Assets imported by components                                                              |
| [`static/`](static)                                                    | Served as-is from the site root                                                            |
| [`.roo/skills/`](.roo/skills)                                          | Reusable agent skills; catalog in [`.roo/skills/README.md`](.roo/skills/README.md)         |
| [`llms/`](llms)                                                        | Third-party `llms.txt` reference corpora; provenance in [`llms/README.md`](llms/README.md) |
| [`.github/workflows/`](.github/workflows)                              | CI                                                                                         |
| [`drizzle.config.ts`](drizzle.config.ts)                               | Drizzle Kit config (schema path, MySQL dialect)                                            |

## Skills & reference material

The repo ships reusable, tool-agnostic **agent skills** that turn this document and the third-party references into repeatable workflows:

- **Catalog:** [`.roo/skills/README.md`](.roo/skills/README.md) lists every skill and when to use it. Start any new task with [`.roo/skills/repo-context/SKILL.md`](.roo/skills/repo-context/SKILL.md) for orientation, then pick the matching skill (`database-workflow`, `auth-setup`, `sveltekit-development`, `ui-development`, `verification`, `new-feature`).
- **Format:** each skill is a folder with a `SKILL.md` (`name`/`description` frontmatter + when-to-use, references, steps, rules). New skills copy [`.roo/skills/_template/SKILL.md`](.roo/skills/_template/SKILL.md). The `name` must match the folder name.
- **Reference corpus:** [`llms/`](llms) holds official `llms.txt` files from external projects (SvelteKit, Drizzle, Better Auth, Tailwind, Vite, Vitest, Zod, Skeleton, Bits UI, Lucide). Skills reference them by path. From a skill at `.roo/skills/<name>/SKILL.md`, the repo root is `../../../`.
- **Keep in sync:** update the affected skills when the project layout changes, and tune them when a new `llms/` file is dropped in.
- **`llms/` is external reference only** — it is third-party documentation, never project documentation. Project truth lives in this file and the source.

## Tech stack & tooling

- **TypeScript**, strict, **ESM** everywhere (`"type": "module"`).
- **SvelteKit 2** + **Svelte 5** (runes mode is forced for non-`node_modules` files in [`vite.config.ts`](vite.config.ts)); `@sveltejs/adapter-auto`.
- **Tailwind CSS 4** — CSS-first, **no `tailwind.config.js`**; the entry is [`src/routes/layout.css`](src/routes/layout.css).
- **UI foundation (installed, not yet wired):** **Skeleton v5** (`@skeletonlabs/skeleton` for the CSS core + themes, `@skeletonlabs/skeleton-svelte` for Svelte components), **Bits UI** (`bits-ui`) headless primitives, **Lucide** (`@lucide/svelte`) for general icons, **Simple Icons** (`simple-icons`) for brand marks.
- **Drizzle ORM + drizzle-kit** on **MySQL** (`mysql2` driver; dialect `mysql`).
- **Better Auth** for authentication.
- **Vite 8** for dev/build; **Vitest 4** for tests (two projects: a browser project on Playwright/Chromium and a node project); **Playwright** for e2e.
- **ESLint** (flat config; it reads `.gitignore` via `includeIgnoreFile`) + **Prettier** (tabs, single quotes, no trailing comma, `printWidth` 100, Svelte and Tailwind plugins).

## Commands

Install (from the repository root):

```bash
npm install
```

| Command               | Does                                                        |
| --------------------- | ----------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                             |
| `npm run build`       | Production build                                            |
| `npm run preview`     | Serve the production build (port 4173)                      |
| `npm run check`       | `svelte-kit sync` + `svelte-check` — **the typecheck gate** |
| `npm run check:watch` | Same, in watch mode                                         |
| `npm run lint`        | `prettier --check .` then `eslint .`                        |
| `npm run format`      | `prettier --write .`                                        |
| `npm run test:unit`   | Vitest — **watch mode**; pass `-- --run` for one pass       |
| `npm run test`        | Units (`--run`) then e2e                                    |
| `npm run test:e2e`    | `playwright install` then `playwright test`                 |
| `npm run db:push`     | Drizzle schema push (dev-time sync)                         |
| `npm run db:generate` | Generate migrations                                         |
| `npm run db:migrate`  | Apply migrations                                            |
| `npm run db:studio`   | Drizzle Studio                                              |
| `npm run auth:schema` | Regenerate `auth.schema.ts` from the Better Auth config     |

**There is no `typecheck` script and no `coverage` script.** `npm run check` is the type gate. Do not
invent `npm run typecheck` — it will fail. Likewise never run bare `npm run test:unit` in CI, because
it watches rather than exiting.

## Environment & setup

A single `.env` at the repository root, loaded by SvelteKit. [`.env.example`](.env.example) is the template; `.gitignore` ignores `.env` and `.env.*` while keeping `!.env.example`.

| Variable             | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`       | MySQL connection string, `mysql://user:password@host:port/database`                 |
| `ORIGIN`             | Site origin (`http://localhost:5173` in dev, `http://localhost:4173` for preview)   |
| `BETTER_AUTH_SECRET` | Better Auth signing secret — 32+ characters of high entropy, unique per environment |

Setup:

```bash
copy .env.example .env     # Windows (cp .env.example .env elsewhere)
```

- **Never commit `.env`.** Keep `.env.example` in sync whenever a variable is added.
- Do not reuse a secret from another project or environment, and do not hardcode secrets in source.

## Database workflow

- **Schema source of truth:** [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts). [`drizzle.config.ts`](drizzle.config.ts) points at it, reads `DATABASE_URL`, and sets `dialect: 'mysql'` with `strict: true`.
- **Generated tables:** [`src/lib/server/db/auth.schema.ts`](src/lib/server/db/auth.schema.ts) is produced by `npm run auth:schema` (the Better Auth CLI). Regenerate it after changing the Better Auth config; never edit it by hand.
- **Workflow:** edit `schema.ts` → `npm run db:generate` → `npm run db:migrate`. While iterating locally, `db:push` syncs the schema directly.
- **Keep DB and auth construction lazy.** Build the Drizzle client and the auth instance on first use rather than at module scope, so `vite build` (including SvelteKit's post-build analysis) never needs a live database.

## Auth architecture

- The Better Auth instance is [`src/lib/server/auth.ts`](src/lib/server/auth.ts); it is wired into requests through [`src/hooks.server.ts`](src/hooks.server.ts), and ambient types live in [`src/app.d.ts`](src/app.d.ts).
- The auth tables are the generated ones in `auth.schema.ts`, re-exported alongside the project schema.
- The scaffold's sign-in/sign-up demo lives at [`src/routes/demo/better-auth/`](src/routes/demo/better-auth); it is a placeholder, not the real auth UX.
- **Authorization is not designed yet.** There is no role model in this project. Do not assume admin/moderator concepts exist; introduce them deliberately when the management domain is defined.

## UI & design system

Skeleton v5, Bits UI, Lucide and Simple Icons are installed but **the global stylesheet is not wired up yet**. Verified facts about the installed versions:

- Skeleton v5 exposes the CSS core at `@skeletonlabs/skeleton` (its `.` export resolves to the package's `index.css`) and each theme at `@skeletonlabs/skeleton/themes/<name>`. **24 built-in themes ship**, including `pine`.
- **`@skeletonlabs/skeleton-svelte` is a Svelte component library, not a stylesheet** — import its components from JavaScript/TypeScript, never from CSS.
- A theme is activated with a `data-theme="<name>"` attribute on the `<html>` element in [`src/app.html`](src/app.html).
- Lucide exposes `@lucide/svelte` plus `./icons` and `./icons/*`, so icons are imported individually (e.g. `@lucide/svelte/icons/<kebab-case-name>`) rather than as a barrel.
- **No theme has been chosen for this project.** `pine` is a placeholder inherited from the project this scaffold was copied from; replace it rather than building on it.

Rules for UI work:

- Use Skeleton tokens and `preset-*` classes for color and styling. **No hardcoded colors.**
- No `<style>` blocks and no inline `style=` attributes unless there is no alternative.
- Lucide for general icons, Simple Icons for brand marks only. **No emoji as UI icons.**
- Prefer a styled Skeleton component for chrome and layout; reach for Bits UI only where Skeleton has no fit.
- Read the specific component section of [`llms/skeletondev/llms-full.txt`](llms/skeletondev/llms-full.txt) or [`llms/bitsui/llms-full.txt`](llms/bitsui/llms-full.txt) before writing markup.

## Scaffold placeholders to replace

These came from `sv create` and are not product features. Delete them as the real features land:

- [`src/routes/demo/`](src/routes/demo) — the `/demo` pages, the Better Auth demo, and the Playwright demo.
- [`src/lib/vitest-examples/`](src/lib/vitest-examples) — `greet.ts`, its specs, and the `Welcome` component.
- The placeholder theme and unwired UI stack described above.

## Known issues

- **The database and auth clients are constructed at module scope, which breaks `npm run build`.** The
  build fails with `TypeError: Invalid URL` (`ERR_INVALID_URL`) thrown from `mysql2`, for the input
  `mysql://user:password@host:port/db-name`.
  - **Cause:** [`src/lib/server/db/index.ts`](src/lib/server/db/index.ts) calls
    `mysql.createPool(env.DATABASE_URL)` at module scope, and
    [`src/lib/server/auth.ts`](src/lib/server/auth.ts) builds the Better Auth instance at module scope
    on top of it. SvelteKit's post-build `analyse` step imports the built server bundle, so importing
    either one creates a connection pool — and with a placeholder `.env`, parsing that URL throws.
  - **Fix (not yet applied):** make both lazy — expose a `getDb()` / `getAuth()` that constructs on
    first call. That is the rule already stated in [Database workflow](#database-workflow) and
    [Auth architecture](#auth-architecture); the code does not follow it yet.
  - CI will not catch this, because the workflow sets a syntactically valid `DATABASE_URL`.
- **No migrations exist yet**, so `npm run db:migrate` is a no-op until the first migration is generated.
- **The UI stack is installed but not wired**, and no theme has been chosen — see
  [UI & design system](#ui--design-system).

## Conventions

- TypeScript strict + ESM throughout; no CommonJS.
- **Run `npm run check` and `npm run lint` (plus the relevant tests) once at the end of a change session** — batch all edits first, then verify. Do not run them after every individual change.
- Prefer server-only code in `src/lib/server/`; never import it from client-side component code.
- Keep secrets in `.env` only, and keep `.env.example` current.
- Update this file when the project layout or tooling changes, and keep the affected skills in sync.
- **Do not reintroduce content from the project this scaffold was copied from.** If you find leftover
  references (another product's names, a game engine, a monorepo layout, a WebSocket/room framework),
  treat them as bugs to remove rather than patterns to follow.
- Verify claims about third-party libraries against `llms/` or the installed package itself before
  writing them down — several inherited documents describe versions and APIs this project does not have.

## Roadmap

1. **Clean up the scaffold** — remove the placeholder routes and test examples, wire the Tailwind +
   Skeleton stylesheet, and choose a theme.
2. **Define the management domain** — accounts, GM levels, characters, bans, live operations — and the
   auth model that goes with it.
3. **AzerothCore integration** — **deferred.** When it starts, document the integration surfaces and
   their security rules _before_ writing code. At minimum that means: the shared `acore_auth`,
   `acore_world` and `acore_characters` MySQL databases; offline SRP6 account provisioning (salt and
   verifier can be computed without running the auth server); the world server's SOAP console on port
   7878 (off by default) and the telnet remote console on 3443, both of which grant console-command
   execution and must never be exposed to the browser; and the fact that the auth and world servers do
   not communicate with each other at all — they are coupled only through `acore_auth`.

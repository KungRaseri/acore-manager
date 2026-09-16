# AGENTS.md — acore-manager

Reference document for AI agents (and humans) working in this repository. This is a reference, not a tutorial.

## Project overview

acore-manager is a **server and player management website for AzerothCore** (World of Warcraft 3.3.5a) servers. It is a **single SvelteKit application** — not a monorepo and not a workspace layout.

- Application code lives in [`src/`](src) (routes under [`src/routes/`](src/routes), server-only code under [`src/lib/server/`](src/lib/server)).
- Reusable **agent skills** live in [`.roo/skills/`](.roo/skills) and their third-party `llms.txt` reference corpus in [`llms/`](llms) — see [Skills & reference material](#skills--reference-material).
- **Status: auth, database and UI plumbing are in place.** The app builds and deploys (see [Deployment](#deployment)); Discord sign-in, the database bootstrap, the Skeleton theme and the `(public)` / `(authenticated)` / `(admin)` route groups all work. Authorization is a documented placeholder, and the AzerothCore integration reaches as far as the SOAP console client — see [Known issues](#known-issues).
- **The AzerothCore integration layer has started, and only the SOAP client exists.** [`src/lib/server/acore/`](src/lib/server/acore) holds a server-only SOAP console client (`executeCommand`, `getServerInfo`) and its protocol helpers — no account provisioning, no character or ban queries. Read [AzerothCore integration](#azerothcore-integration) for the rules that already apply, then [Roadmap](#roadmap), before extending it.

## Repository layout

| Path                                                                   | Role                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`src/routes/`](src/routes)                                            | SvelteKit routes, grouped into `(public)`, `(authenticated)` and `(admin)`                 |
| [`src/routes/layout.css`](src/routes/layout.css)                       | Tailwind 4 entry point; also the stylesheet Prettier uses for Tailwind class sorting       |
| [`src/hooks.server.ts`](src/hooks.server.ts)                           | SvelteKit server hooks                                                                     |
| [`src/app.html`](src/app.html)                                         | HTML shell; where a Skeleton `data-theme` attribute belongs                                |
| [`src/app.d.ts`](src/app.d.ts)                                         | SvelteKit ambient types (`App.Locals`, …)                                                  |
| [`src/lib/server/auth.ts`](src/lib/server/auth.ts)                     | Better Auth instance — `getAuth()`, server-only, built lazily                              |
| [`src/lib/server/db/index.ts`](src/lib/server/db/index.ts)             | Drizzle client — `getDb()`, built lazily                                                   |
| [`src/routes/(public)/login/`](<src/routes/(public)/login>)            | Discord sign-in route                                                                      |
| [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts)           | **Schema source of truth**                                                                 |
| [`src/lib/server/db/auth.schema.ts`](src/lib/server/db/auth.schema.ts) | **Generated** Better Auth tables — never hand-edit                                         |
| [`src/lib/assets/`](src/lib/assets)                                    | Assets imported by components                                                              |
| [`static/`](static)                                                    | Served as-is from the site root                                                            |
| [`src/themes/azeroth.css`](src/themes/azeroth.css)                     | The project's Skeleton theme — design tokens for `data-theme="azeroth"`                    |
| [`src/lib/components/site/`](src/lib/components/site)                  | Site chrome: app shell, navigation, user menu, mode toggle                                 |
| [`src/lib/navigation.ts`](src/lib/navigation.ts)                       | Navigation data and the active-item rule                                                   |
| [`src/lib/user.ts`](src/lib/user.ts)                                   | `CurrentUser` — the user shape the UI is allowed to see                                    |
| [`src/lib/auth-client.ts`](src/lib/auth-client.ts)                     | Browser-side Better Auth client (sign-out; later account linking)                          |
| [`src/lib/server/authz.ts`](src/lib/server/authz.ts)                   | Authorization — the one place that answers "may this user do this?"                        |
| [`src/lib/server/accounts/`](src/lib/server/accounts)                  | Game accounts — console provisioning, SRP6 credential check, linking                       |
| [`.roo/skills/`](.roo/skills)                                          | Reusable agent skills; catalog in [`.roo/skills/README.md`](.roo/skills/README.md)         |
| [`llms/`](llms)                                                        | Third-party `llms.txt` reference corpora; provenance in [`llms/README.md`](llms/README.md) |
| [`.github/workflows/`](.github/workflows)                              | CI                                                                                         |
| [`drizzle.config.ts`](drizzle.config.ts)                               | Drizzle Kit config (schema path, MySQL dialect)                                            |
| [`migrate.mjs`](migrate.mjs)                                           | Runtime bootstrap: creates the database if missing, then applies migrations                |
| [`docker-entrypoint.sh`](docker-entrypoint.sh)                         | Container entrypoint: runs `migrate.mjs`, then starts the built server                     |
| [`Dockerfile`](Dockerfile)                                             | Two-stage image build (adapter-node output plus the migration tooling)                     |
| [`.dockerignore`](.dockerignore)                                       | Keeps `.env`, `node_modules` and VCS metadata out of image layers                          |

## Skills & reference material

The repo ships reusable, tool-agnostic **agent skills** that turn this document and the third-party references into repeatable workflows:

- **Catalog:** [`.roo/skills/README.md`](.roo/skills/README.md) lists every skill and when to use it. Start any new task with [`.roo/skills/repo-context/SKILL.md`](.roo/skills/repo-context/SKILL.md) for orientation, then pick the matching skill (`database-workflow`, `auth-setup`, `sveltekit-development`, `ui-development`, `verification`, `new-feature`).
- **Format:** each skill is a folder with a `SKILL.md` (`name`/`description` frontmatter + when-to-use, references, steps, rules). New skills copy [`.roo/skills/_template/SKILL.md`](.roo/skills/_template/SKILL.md). The `name` must match the folder name.
- **Reference corpus:** [`llms/`](llms) holds official `llms.txt` files from external projects (SvelteKit, Drizzle, Better Auth, Tailwind, Vite, Vitest, Zod, Skeleton, Bits UI, Lucide). Skills reference them by path. From a skill at `.roo/skills/<name>/SKILL.md`, the repo root is `../../../`.
- **Keep in sync:** update the affected skills when the project layout changes, and tune them when a new `llms/` file is dropped in.
- **`llms/` is external reference only** — it is third-party documentation, never project documentation. Project truth lives in this file and the source.

## Tech stack & tooling

- **TypeScript**, strict, **ESM** everywhere (`"type": "module"`).
- **SvelteKit 2** + **Svelte 5** (runes mode is forced for non-`node_modules` files in [`vite.config.ts`](vite.config.ts)); **`@sveltejs/adapter-node`** — the app runs as a Node server, not on a managed platform.
- **Tailwind CSS 4** — CSS-first, **no `tailwind.config.js`**; the entry is [`src/routes/layout.css`](src/routes/layout.css).
- **UI foundation (wired):** **Skeleton v5** (`@skeletonlabs/skeleton` for the CSS core + themes, `@skeletonlabs/skeleton-svelte` for Svelte components, which are styled by `@skeletonlabs/skeleton-common` — re-exported through that package's `style` condition), **Bits UI** (`bits-ui`) headless primitives, **Lucide** (`@lucide/svelte`) for general icons, **Simple Icons** (`simple-icons`) for brand marks.
- **Drizzle ORM + drizzle-kit** on **MySQL** (`mysql2` driver; dialect `mysql`).
- **Better Auth** for authentication, with **Discord** as the only sign-in provider (email/password is not enabled).
- **Vite 7** for dev/build; **Vitest 3** for unit tests — two projects: a `client` project on **jsdom** (`@testing-library/svelte` + `@testing-library/jest-dom`) and a `server` node project; **Playwright** for e2e only. No unit test runs in a real browser.
- **Version coupling:** `vite@7` ⇄ `vitest@3` ⇄ `@sveltejs/vite-plugin-svelte@6`. `@sveltejs/kit` accepts Vite 5–8 and `@tailwindcss/vite` accepts 5–8, but `@sveltejs/vite-plugin-svelte@7` requires Vite 8. Bump all three together — a mismatched pair installs a **second, nested copy of Vite**, and `npm run check` then fails on [`vite.config.ts`](vite.config.ts) with incompatible `Plugin` types.
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

| Variable                | Purpose                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | MySQL connection string, `mysql://user:password@host:port/database`                                                                                                 |
| `ORIGIN`                | Site origin (`http://localhost:5173` in dev, `http://localhost:4173` for preview)                                                                                   |
| `BETTER_AUTH_SECRET`    | Better Auth signing secret — 32+ characters of high entropy, unique per environment                                                                                 |
| `DISCORD_CLIENT_ID`     | Discord OAuth application id ([discord.com/developers/applications](https://discord.com/developers/applications))                                                   |
| `DISCORD_CLIENT_SECRET` | Discord OAuth application secret                                                                                                                                    |
| `ACORE_DATABASE_URL`    | AzerothCore's MySQL server and credentials — deliberately **no database in the URL**, since the database name is chosen per client (`acore_auth`, `acore_world`, …) |

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
- **Drizzle does not create the database.** Creating it is a separate, one-time bootstrap, handled by [`migrate.mjs`](migrate.mjs) — see [Deployment](#deployment). `drizzle-kit migrate` alone will fail against a database that does not exist yet.
- **Keep DB and auth construction lazy.** `getDb()` and `getAuth()` construct on first use. Nothing may build a client or adapter at module scope, or `vite build` (including SvelteKit's post-build analysis) will need a live database.
- **AzerothCore's databases are not ours.** `acore_auth`, `acore_world`, `acore_characters` and `acore_playerbots` are owned and migrated by AzerothCore's own SQL updater. Reach them through the plain `mysql2` pools in [`src/lib/server/db/acore.ts`](src/lib/server/db/acore.ts) — `getAcoreAuthDb()`, `getAcoreWorldDb()`, `getAcoreCharactersDb()`, or `getAcoreDb(name)` for any entry in `ACORE_DATABASES`. They share a single `ACORE_DATABASE_URL` (server and credentials only) and differ by database name.
- **Never point `drizzle-kit` at an AzerothCore database, and never declare its tables in a Drizzle schema.** Only a subset would ever be declared, so `db:push` would then try to drop everything it was not told about. Migrations exist for `acore_manager` alone.
- **There are no cross-database transactions.** MySQL cannot commit atomically across `acore_manager` and an AC database, so any operation touching both must be made idempotent and retryable instead of transactional.

## Route groups & authorization

Routes are grouped, and the group layout carries the rule:

| Group                        | URLs                      | Layout does                                                          |
| ---------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `src/routes/(public)`        | `/`, `/login`             | Public chrome (header + footer); serves anonymous visitors           |
| `src/routes/(authenticated)` | `/dashboard`, `/accounts` | `requireUser()` — redirects to `/login?redirectTo=…` when signed out |
| `src/routes/(admin)`         | `/admin`                  | `requireUser()` then `requireServerManager()` — 403 when not allowed |

- Parentheses mean the folder **does not appear in the URL**: `(public)/login` serves `/login`.
- Two groups cannot both own `/`, which is why the admin area lives under `/admin`.
- **Authorization lives in [`src/lib/server/authz.ts`](src/lib/server/authz.ts) and nowhere else.** Layouts call `requireUser` / `requireServerManager`; pages do not re-check. `isServerManager` currently admits every signed-in user — the explicit project decision — and that file documents the GM-level query that will replace it.
- `safeRedirectTarget()` guards the `redirectTo` parameter: only same-site paths survive, because the value reaches an OAuth `callbackURL`.
- Client components cannot import `$lib/server`, so a layout that needs an authorization fact computes it in `+layout.server.ts` and passes it down as data (see `showAdminNav` in the `(authenticated)` layout).

## AzerothCore integration

The integration layer is server-only, lives in [`src/lib/server/acore/`](src/lib/server/acore), and is reached through two entry points:

- **Databases** — [`src/lib/server/db/acore.ts`](src/lib/server/db/acore.ts) hands out plain `mysql2` pools (`getAcoreAuthDb()`, `getAcoreWorldDb()`, `getAcoreCharactersDb()`, `getAcoreDb()`). One `ACORE_DATABASE_URL` (server and credentials only) is shared; the database name is the only difference. Never declare these tables in Drizzle and never point `drizzle-kit` at them.
- **Console** — [`src/lib/server/acore/soap.ts`](src/lib/server/acore/soap.ts) runs worldserver console commands over SOAP. It is an administrator credential with arbitrary command execution behind it, so: calls are serialised one at a time (the worldserver serves SOAP on a single thread), every call has a timeout (there is no server-side one), and nothing may import it from client-side code. `SOAP.Enabled = 1` and `SEC_ADMINISTRATOR` are prerequisites; both are documented in [`.env.example`](.env.example).

## Game accounts

Creating and linking a game account lives in [`src/lib/server/accounts/`](src/lib/server/accounts):

- **Creation goes through the worldserver**, the way the official procedure describes it: the site runs
  `account create <username> <password>` over the console (SOAP), so the server computes the SRP6 salt
  and verifier itself. This project writes nothing into `acore_auth`; the only table it owns here is the
  `game_account` mapping in [`schema.ts`](src/lib/server/db/schema.ts).
- **Linking verifies the account's own password** against the salt and verifier already on the
  `acore_auth.account` row — the same check the auth server performs at logon. It is read-only: no
  password is set or reset, and no administrator command runs on the visitor's behalf. One message covers
  "no such account" and "wrong password" on purpose, so the form cannot be used to enumerate accounts.
- **The SRP6 check is transcribed, not invented.** [`srp6.ts`](src/lib/server/accounts/srp6.ts) documents
  the two details that make it work — the game's own `N` and `g`, and `BigNumber`'s little-endian default
  for both the digest and the stored verifier. Getting either wrong can only deny a valid attempt, never
  grant an invalid one.
- **Rules** ([`rules.ts`](src/lib/server/accounts/rules.ts)) mirror the server's limits
  (`MAX_ACCOUNT_STR` 17, `MAX_PASS_STR` 16) and add two of ours: alphanumeric usernames, and no
  whitespace in a _new_ password — both because the value is interpolated into a space-delimited console
  command. Passwords for _existing_ accounts are deliberately left unconstrained, because they are hashed
  and never sent to a console.
- **The two steps are not transactional.** MySQL cannot commit across `acore_manager` and `acore_auth`, so
  an account can exist on the realm without being linked. That state is recoverable by design: the link
  form is the repair path, and the failure message says so.
- **Unlinking deletes the mapping row only.** The game account, its characters and its password are
  untouched. Deleting an account is a server operation with consequences the UI cannot undo, so it is not
  offered.

## Auth architecture

- The Better Auth instance is [`src/lib/server/auth.ts`](src/lib/server/auth.ts); it is wired into requests through [`src/hooks.server.ts`](src/hooks.server.ts), and ambient types live in [`src/app.d.ts`](src/app.d.ts).
- The auth tables are the generated ones in `auth.schema.ts`, re-exported alongside the project schema.
- **Sign-in is Discord only.** [`src/routes/(public)/login/`](<src/routes/(public)/login>) posts to a form action that asks Better Auth for the Discord authorization URL and redirects the browser to it. The scaffold's email/password demo has been deleted.
- The Discord application must list this redirect URI: `<ORIGIN>/api/auth/callback/discord`.
- **Authorization is a placeholder, and it has one home.** [`src/lib/server/authz.ts`](src/lib/server/authz.ts) decides access: `requireUser()` for the `(authenticated)` group, `requireServerManager()` for `(admin)`. The latter admits any signed-in user today — deliberate, and documented in that file — until the GM level on a linked game account can be read from `acore_auth`. Do not add per-route checks elsewhere and do not assume a role model exists. (Note: this is not the Better Auth `admin` plugin; roles are not stored on `user`.)

## UI & design system

Skeleton v5, Bits UI, Lucide and Simple Icons are installed, and the stylesheet is wired through [`src/routes/layout.css`](src/routes/layout.css). Verified facts about the installed versions:

- **The CSS entry chain is three imports:** `@skeletonlabs/skeleton` (tokens, Tailwind utilities, presets), `@skeletonlabs/skeleton-svelte` (the _component_ stylesheets, re-exported from `@skeletonlabs/skeleton-common`), then the project theme. Order matters: the theme overrides the core's `:root` defaults at equal specificity, so it must come last.
- **The component stylesheet import is required.** Without `@import '@skeletonlabs/skeleton-svelte'` in the global stylesheet, Skeleton's components render structurally but unstyled. (Older notes in `llms/` claim that package is never imported from CSS; that is wrong for v5, where its `style` export points at `dist/index.css`.)
- **The project theme is `azeroth`** — [`src/themes/azeroth.css`](src/themes/azeroth.css), a custom World of Warcraft–style palette (gold primary, arcane secondary, fel tertiary, warm stone surfaces), activated by `data-theme="azeroth"` on `<html>` in [`src/app.html`](src/app.html). Built-in themes under `@skeletonlabs/skeleton/themes/*` remain available but are unused.
- **Light/dark mode is class-based, not media-based.** [`layout.css`](src/routes/layout.css) redefines Tailwind's `dark` variant as `&:where(.dark, .dark *)`, so `.dark` on `<html>` drives both `dark:` utilities and Skeleton's `color-scheme` — and therefore every `light-dark()` color pairing. The class is applied before first paint by an inline script in `app.html` and toggled by [`ModeToggle.svelte`](src/lib/components/site/ModeToggle.svelte), which is deliberately stateless (no `$state`, no hydration mismatch).
- **Skeleton's Svelte components are Zag.js wrappers.** Their parts are styled by `data-scope`/`data-part` CSS from `@skeletonlabs/skeleton-common`, and their APIs are React-flavoured in the docs: the Svelte props are `class` (not `className`), and some callbacks live on the root — e.g. `Menu` reports selection through `MenuProps.onSelect`, while `Menu.Item` only takes `value`/`disabled`/`closeOnSelect`.
- **Bits UI is for primitives Skeleton has no counterpart for** — currently the mobile nav drawer (`Dialog`) and the `Separator` in the user menu.
- Lucide exposes `@lucide/svelte` plus `./icons` and `./icons/*`, so icons are imported individually (e.g. `@lucide/svelte/icons/<kebab-case-name>`) rather than as a barrel. Simple Icons is for brand marks only (the Discord mark on the sign-in page).

Rules for UI work:

- Use Skeleton tokens and `preset-*` classes for color and styling. **No hardcoded colors.**
- No `<style>` blocks and no inline `style=` attributes unless there is no alternative.
- **Do not write a `{/* … */}` comment across multiple lines in markup** — Svelte's parser rejects the multi-line form and the failure surfaces as dozens of unrelated errors. Use `<!-- … -->`.
- **Every internal `href` and `goto()` goes through `resolve()`** from `$app/paths`; ESLint's `svelte/no-navigation-without-resolve` enforces it. Navigation data in [`src/lib/navigation.ts`](src/lib/navigation.ts) is resolved once, when defined.
- Lucide for general icons, Simple Icons for brand marks only. **No emoji as UI icons.**
- Prefer a styled Skeleton component for chrome and layout; reach for Bits UI only where Skeleton has no fit.
- Read the specific component section of [`llms/skeletondev/llms-full.txt`](llms/skeletondev/llms-full.txt) or [`llms/bitsui/llms-full.txt`](llms/bitsui/llms-full.txt) before writing markup.

## Scaffold placeholders to replace

These came from `sv create` and are not product features:

- The `/demo` routes are **gone**; the Playwright smoke test that pointed at them now covers the public landing page ([`src/routes/(public)/page.e2e.ts`](<src/routes/(public)/page.e2e.ts>)).
- [`src/lib/vitest-examples/`](src/lib/vitest-examples) — `greet.ts`, its specs and the `Welcome` component. **Delete them only once real tests exist**, because they are currently the only specs in the repository and both `npm run test:unit -- --run` and `playwright test` fail when no test files match.
- The placeholder `pine` theme and the unwired UI stack are **gone**; the `azeroth` theme replaced them.

## Known issues

- **Authorization is open.** `isServerManager()` admits every signed-in user, so `/admin` is reachable by
  anyone who can sign in. Deliberate, until the GM level on a linked game account can be read — see
  [Route groups & authorization](#route-groups--authorization).
- **The authorization rule is still missing.** `game_account` now maps a profile to a game account, so
  what remains is reading the GM level for that account — see
  [Route groups & authorization](#route-groups--authorization).
- **The UI is dark by default.** `app.html` adds `.dark` unless the visitor opted into light mode;
  nothing follows `prefers-color-scheme`.
- **`game_account` has no migration yet.** The table is declared in `schema.ts` and the feature works
  end to end once it exists, but `drizzle/` still holds only the Better Auth migration — run
  `npm run db:generate` and commit the result.
- **The console UI is deliberately read-only.** `/admin` can run `.server info`; there is no command box
  until access is decided by GM level.
- **e2e tests need a live database and downloaded browsers**, so `npm run test:e2e` is not part of routine
  verification — but `playwright test` does expect at least one matching spec.

## Deployment

The app ships as a container. `@sveltejs/adapter-node` produces `build/`, and the entrypoint bootstraps
the database before starting the server:

- [`Dockerfile`](Dockerfile) — two-stage build. The runtime stage keeps `node_modules` on purpose,
  because [`migrate.mjs`](migrate.mjs) needs `drizzle-orm` and `mysql2` and this app declares no
  `dependencies` for a production prune to retain.
- [`docker-entrypoint.sh`](docker-entrypoint.sh) — runs `node migrate.mjs`, then `node build/index.js`.
- [`migrate.mjs`](migrate.mjs) — creates the database (`CREATE DATABASE IF NOT EXISTS`, utf8mb4) before
  running `drizzle-orm/mysql2/migrator`, retries while the database is still starting, and fails with an
  actionable message when the user lacks `CREATE` rights. Both steps are idempotent, so restarts are no-ops.
- [`.dockerignore`](.dockerignore) — keeps `.env` and `node_modules` out of the build context; without it
  `COPY . .` would bake real credentials into an image layer.

Runtime environment: `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`. **`ORIGIN` must be the browser-facing origin** or adapter-node rejects
cross-origin form submissions. The image build needs no database and no secrets — which is exactly why
the DB and auth clients are lazy.

Run it by hand the way the container does:

```bash
node migrate.mjs      # create the database if needed, then apply migrations
node build/index.js   # serve (PORT, default 3000)
```

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

1. **UI, theming and route groups.** _Done_ — the `azeroth` theme, the site chrome, the
   `(public)` / `(authenticated)` / `(admin)` groups and the centralized `authz` helper.
2. **Game accounts — create and link.** _Done_ — creation runs the worldserver's own `account create`
   over SOAP, linking verifies the account's password against the credentials stored in `acore_auth`, and
   `game_account` records the result against a profile. Remaining: generate the migration, and decide what
   staff tooling should exist around a link (who may detach one, and what happens to the account).
3. **Close the authorization gate.** Read `gmlevel` from `acore_auth.account_access` for the linked game
   account, require `SEC_ADMINISTRATOR`, and replace `isServerManager()`.
4. **Characters, bans and live operations** — the rest of the management domain, on top of
   `acore_characters` and the SOAP console.
5. **AzerothCore integration rules.** What already applies is in
   [AzerothCore integration](#azerothcore-integration). Before adding features on top: the auth and world
   servers do not communicate with each other at all — they are coupled only through `acore_auth` — and
   the telnet remote console on port 3443 grants the same command execution as SOAP and must never be
   exposed to the browser.

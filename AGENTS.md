# AGENTS.md — acore-manager

Reference document for AI agents (and humans) working in this repository. This is a reference, not a tutorial.

## Project overview

acore-manager is a **server and player management website for AzerothCore** (World of Warcraft 3.3.5a) servers. It is a **single SvelteKit application** — not a monorepo and not a workspace layout.

- Application code lives in [`src/`](src) (routes under [`src/routes/`](src/routes), server-only code under [`src/lib/server/`](src/lib/server)).
- Reusable **agent skills** live in [`.roo/skills/`](.roo/skills) and their third-party `llms.txt` reference corpus in [`llms/`](llms) — see [Skills & reference material](#skills--reference-material).
- **Status: everything the site ships works end to end.** The app builds and deploys (see [Deployment](#deployment)); Discord sign-in, the database bootstrap, the Skeleton theme and the `(public)` / `(authenticated)` / `(staff)` route groups all work. Authorization is tiered from the GM level on a profile's linked game accounts, game accounts can be created and linked, characters are readable, and the **GM command console** browses and runs what the realm declares — with every attempt written to an audit trail — see [Known issues](#known-issues).
- **The AzerothCore integration layer is server-only and has three surfaces.** [`src/lib/server/acore/`](src/lib/server/acore) holds the SOAP console client (`executeCommand`, `getServerInfo`) and its protocol helpers, and the command catalogue read from `acore_world.command`; [`src/lib/server/db/acore.ts`](src/lib/server/db/acore.ts) hands out the plain `mysql2` pools. What the console may run is decided by [`src/lib/gm-commands.ts`](src/lib/gm-commands.ts) and recorded by [`src/lib/server/commands/`](src/lib/server/commands). Read [AzerothCore integration](#azerothcore-integration) and [GM command console & audit trail](#gm-command-console--audit-trail) for the rules that apply, then [Roadmap](#roadmap), before extending it.

## Repository layout

| Path                                                                                            | Role                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`src/routes/`](src/routes)                                                                     | SvelteKit routes, grouped into `(public)`, `(authenticated)` and `(staff)`                 |
| [`src/routes/layout.css`](src/routes/layout.css)                                                | Tailwind 4 entry point; also the stylesheet Prettier uses for Tailwind class sorting       |
| [`src/hooks.server.ts`](src/hooks.server.ts)                                                    | SvelteKit server hooks                                                                     |
| [`src/app.html`](src/app.html)                                                                  | HTML shell; where a Skeleton `data-theme` attribute belongs                                |
| [`src/app.d.ts`](src/app.d.ts)                                                                  | SvelteKit ambient types (`App.Locals`, …)                                                  |
| [`src/lib/server/auth.ts`](src/lib/server/auth.ts)                                              | Better Auth instance — `getAuth()`, server-only, built lazily                              |
| [`src/lib/server/db/index.ts`](src/lib/server/db/index.ts)                                      | Drizzle client — `getDb()`, built lazily                                                   |
| [`src/routes/(public)/login/`](<src/routes/(public)/login>)                                     | Discord sign-in route                                                                      |
| [`src/routes/(staff)/staff/moderator/commands/`](<src/routes/(staff)/staff/moderator/commands>) | GM command console — browse the realm's commands, run the ones this level may run          |
| [`src/routes/(staff)/staff/admin/audit/`](<src/routes/(staff)/staff/admin/audit>)               | Audit trail — one page of console attempts, newest first, read-only                        |
| [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts)                                    | **Schema source of truth**                                                                 |
| [`src/lib/server/db/auth.schema.ts`](src/lib/server/db/auth.schema.ts)                          | **Generated** Better Auth tables — never hand-edit                                         |
| [`src/lib/assets/`](src/lib/assets)                                                             | Assets imported by components                                                              |
| [`static/`](static)                                                                             | Served as-is from the site root; holds the extracted item icons (git-ignored)              |
| [`src/themes/azeroth.css`](src/themes/azeroth.css)                                              | The project's Skeleton theme — design tokens for `data-theme="azeroth"`                    |
| [`src/lib/components/site/`](src/lib/components/site)                                           | Site chrome: app shell, navigation, user menu, mode toggle                                 |
| [`src/lib/components/characters/`](src/lib/components/characters)                               | Character pages: the item icon with its placeholder fallback                               |
| [`src/lib/components/commands/`](src/lib/components/commands)                                   | Console and trail UI — command browser, row, runner, output, audit table                   |
| [`src/lib/navigation.ts`](src/lib/navigation.ts)                                                | Navigation data and the active-item rule                                                   |
| [`src/lib/user.ts`](src/lib/user.ts)                                                            | `CurrentUser` — the user shape the UI is allowed to see                                    |
| [`src/lib/auth-client.ts`](src/lib/auth-client.ts)                                              | Browser-side Better Auth client (sign-out; later account linking)                          |
| [`src/lib/server/authz.ts`](src/lib/server/authz.ts)                                            | Authorization — the one place that answers "may this user do this?"                        |
| [`src/lib/access.ts`](src/lib/access.ts)                                                        | The tier vocabulary — `SEC_*` constants and the level-to-tier mapping                      |
| [`src/lib/server/acore/access.ts`](src/lib/server/acore/access.ts)                              | GM levels read from `acore_auth.account_access`, one query, read-only                      |
| [`src/lib/server/acore/commands.ts`](src/lib/server/acore/commands.ts)                          | GM command catalogue — one read-only `SELECT` on `acore_world.command`                     |
| [`src/lib/server/accounts/`](src/lib/server/accounts)                                           | Game accounts — console provisioning, SRP6 credential check, linking, ownership            |
| [`src/lib/server/characters/`](src/lib/server/characters)                                       | Characters — reads on `acore_characters`, names and items from `acore_world`               |
| [`src/lib/server/commands/`](src/lib/server/commands)                                           | The audited command runner (`audit.ts`) and the console-line argument rules (`rules.ts`)   |
| [`src/lib/characters.ts`](src/lib/characters.ts)                                                | Character vocabulary — money, playtime, timestamps, quality, slot labels, icon URLs        |
| [`src/lib/gm-commands.ts`](src/lib/gm-commands.ts)                                              | GM command vocabulary and the restrict-only policy overlay — client-safe                   |
| [`.roo/skills/`](.roo/skills)                                                                   | Reusable agent skills; catalog in [`.roo/skills/README.md`](.roo/skills/README.md)         |
| [`llms/`](llms)                                                                                 | Third-party `llms.txt` reference corpora; provenance in [`llms/README.md`](llms/README.md) |
| [`.github/workflows/`](.github/workflows)                                                       | CI                                                                                         |
| [`drizzle.config.ts`](drizzle.config.ts)                                                        | Drizzle Kit config (schema path, MySQL dialect)                                            |
| [`migrate.mjs`](migrate.mjs)                                                                    | Runtime bootstrap: creates the database if missing, then applies migrations                |
| [`docker-entrypoint.sh`](docker-entrypoint.sh)                                                  | Container entrypoint: runs `migrate.mjs`, then starts the built server                     |
| [`Dockerfile`](Dockerfile)                                                                      | Two-stage image build (adapter-node output plus the migration tooling)                     |
| [`.dockerignore`](.dockerignore)                                                                | Keeps `.env`, `node_modules` and VCS metadata out of image layers                          |
| [`drizzle/`](drizzle)                                                                           | Generated migrations; `0002_quick_jack_murdock.sql` adds `command_audit`                   |

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
- **The repository owner runs the Drizzle CLI.** `db:generate`, `db:migrate`, `db:push` and `db:studio` are run by hand, not by an agent: an agent edits `schema.ts`, then reports plainly that a migration is pending (generated, or not). Do not spend a run trying to invoke them.
- **Drizzle does not create the database.** Creating it is a separate, one-time bootstrap, handled by [`migrate.mjs`](migrate.mjs) — see [Deployment](#deployment). `drizzle-kit migrate` alone will fail against a database that does not exist yet.
- **Keep DB and auth construction lazy.** `getDb()` and `getAuth()` construct on first use. Nothing may build a client or adapter at module scope, or `vite build` (including SvelteKit's post-build analysis) will need a live database.
- **AzerothCore's databases are not ours.** `acore_auth`, `acore_world`, `acore_characters` and `acore_playerbots` are owned and migrated by AzerothCore's own SQL updater. Reach them through the plain `mysql2` pools in [`src/lib/server/db/acore.ts`](src/lib/server/db/acore.ts) — `getAcoreAuthDb()`, `getAcoreWorldDb()`, `getAcoreCharactersDb()`, or `getAcoreDb(name)` for any entry in `ACORE_DATABASES`. They share a single `ACORE_DATABASE_URL` (server and credentials only) and differ by database name.
- **Never point `drizzle-kit` at an AzerothCore database, and never declare its tables in a Drizzle schema.** Only a subset would ever be declared, so `db:push` would then try to drop everything it was not told about. Migrations exist for `acore_manager` alone.
- **There are no cross-database transactions.** MySQL cannot commit atomically across `acore_manager` and an AC database, so any operation touching both must be made idempotent and retryable instead of transactional.

## Route groups & authorization

Routes are grouped, and the group layout carries the rule:

| Group                        | URLs                                                                                     | Layout does                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/routes/(public)`        | `/`, `/login`                                                                            | Public chrome (header + footer); serves anonymous visitors                                                   |
| `src/routes/(authenticated)` | `/dashboard`, `/accounts`                                                                | `requireUser()` — redirects to `/login?redirectTo=…` when signed out                                         |
| `src/routes/(staff)`         | `/staff`, `/staff/**` (nested floors: `/staff/moderator/commands`, `/staff/admin/audit`) | `requireUser()` then `requireStaff()` — 403 below gmlevel 1; folders beneath carry their own, stricter floor |

- Parentheses mean the folder **does not appear in the URL**: `(public)/login` serves `/login`.
- Two groups cannot both own `/`.
- **Authorization lives in [`src/lib/server/authz.ts`](src/lib/server/authz.ts) and nowhere else.** Group and folder layouts call the `require*` helpers; pages do not re-check.
- **An action is not covered by a layout.** SvelteKit runs a form action _before_ the page's `load` functions, so a layout's 403 arrives after the action has already run its side effects. Any action that does something a plain player may not calls a `require*` helper itself — and the accounts actions document why `requireUser` alone is enough for them.
- `safeRedirectTarget()` guards the `redirectTo` parameter: only same-site paths survive, because the value reaches an OAuth `callbackURL`.
- Client components cannot import `$lib/server`, so a layout that needs an authorization fact computes it in `+layout.server.ts` and passes it down as data. What crosses is the **fact** — the tier — never a `NavItem`: an item carries an icon component and load data is serialized as JSON. The shell filters the static nav arrays with the tier it is given, which is cosmetic, since the route an item points at is what the layout guards.

### The tier ladder

Access is the GM level on the game accounts linked to a profile, read from `acore_auth.account_access`:

| Route                       | Floor                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `/staff`                    | `SEC_MODERATOR` (1) and up — the staff dashboard                                         |
| `/staff/moderator`          | `SEC_MODERATOR` (1) and up — moderation tools                                            |
| `/staff/gm`                 | `SEC_GAMEMASTER` (2) and up — read-only diagnostics                                      |
| `/staff/admin`              | `SEC_ADMINISTRATOR` (3) and up — what can act on the realm                               |
| `/staff/moderator/commands` | `SEC_MODERATOR` (1) and up — the command console: browse the realm's commands            |
| `/staff/admin/audit`        | `SEC_ADMINISTRATOR` (3) and up — the audit trail: every attempt, newest first, read-only |

- **The folder name is the floor, and that is part of the contract.** A tool lives in the folder matching its _softest_ audience, and a leaf may be stricter than its folder but never laxer. [`src/lib/server/staff-routes.spec.ts`](src/lib/server/staff-routes.spec.ts) walks the route tree and fails the build when a folder with a page does not declare a floor at or above the one its name implies — because the group layout carries the _weakest_ rule, a folder with no layout would otherwise inherit it silently.
- The ladder as vocabulary is [`src/lib/access.ts`](src/lib/access.ts), deliberately client-safe so the nav and the layouts name the same tiers. The query is [`src/lib/server/acore/access.ts`](src/lib/server/acore/access.ts), read-only and indexed, `MAX(gmlevel)` across the profile's linked accounts.
- **Any `account_access` row counts, whatever its `RealmID`** — this site has no realm model, so a realm-scoped game master has site-wide staff access. A known widening, recorded in [`plans/gm-level-gating.md`](plans/gm-level-gating.md).
- **Nothing is cached.** The level is resolved on every request and memoised only within that request, so a change applies to the next request and there is no stale state. The cost is two indexed queries per signed-in request.
- **It fails closed.** A level that cannot be read — AzerothCore unreachable, `ACORE_DATABASE_URL` unset — means `player`, logged, never a 500 and never staff access.
- A profile with no linked game account has no level and sees no staff page; linking one on the accounts page is the prerequisite.
- **Ownership is a different question from the tier**, and it has its own helper. `requireOwnedAccount()` answers "is _this_ game account this visitor's?" for the account whose page is being opened. An account belongs to a profile when a `game_account` row links it, or when `account.email` is the profile's Discord address — the same rule the accounts page lists by, defined once in [`ownership.ts`](src/lib/server/accounts/ownership.ts) so the page and the URL behind it can never disagree. It answers 404 for "not yours" and "not there" alike, so it cannot be used to work out which names exist.
- **A route's floor is not a command's floor.** The console sits in the `moderator` folder because a command browser's _softest_ audience is a moderator, but what a visitor may actually _run_ is decided per command, in that folder's own action: `requireCommandLevel()` in [`authz.ts`](src/lib/server/authz.ts) compares the visitor's own level with the `security` the realm declares for that command. A tier-1 route therefore hosts commands the realm declares at 2 or 3 — they are listed and disabled with the realm's number shown, so the page can explain "needs gmlevel 3" rather than hide it, and a forged POST is refused, audited and never sent.
- **A nested folder states its own floor, and names exactly one floor helper.** [`staff-routes.spec.ts`](src/lib/server/staff-routes.spec.ts) finds that declaration by searching the layout's text — comments included — and counts only the three helpers it knows (`requireStaff`, `requireGameMaster`, `requireServerManager`), so naming two of _those_ anywhere in the file, even in prose, fails the build. `/staff/moderator/commands` declares `requireStaff`; `/staff/admin/audit` declares `requireServerManager`.

## AzerothCore integration

The integration layer is server-only, lives in [`src/lib/server/acore/`](src/lib/server/acore), and is reached through three entry points:

- **Databases** — [`src/lib/server/db/acore.ts`](src/lib/server/db/acore.ts) hands out plain `mysql2` pools (`getAcoreAuthDb()`, `getAcoreWorldDb()`, `getAcoreCharactersDb()`, `getAcoreDb()`). One `ACORE_DATABASE_URL` (server and credentials only) is shared; the database name is the only difference. Never declare these tables in Drizzle and never point `drizzle-kit` at them.
- **Console** — [`src/lib/server/acore/soap.ts`](src/lib/server/acore/soap.ts) runs worldserver console commands over SOAP. It is an administrator credential with arbitrary command execution behind it, so: calls are serialised one at a time (the worldserver serves SOAP on a single thread), every call has a timeout (there is no server-side one), and nothing may import it from client-side code. `SOAP.Enabled = 1` and `SEC_ADMINISTRATOR` are prerequisites; both are documented in [`.env.example`](.env.example).
- **Command catalogue** — [`src/lib/server/acore/commands.ts`](src/lib/server/acore/commands.ts) reads the realm's own `acore_world.command` table with one read-only `SELECT` on `getAcoreWorldDb()` and maps each row to a [`GmCommand`](src/lib/gm-commands.ts). The realm's `security` column is the authority for what a command demands — the core adopts it at boot, so a gate built on it matches what the realm asks of an in-game caller — and this site keeps no security number of its own. Nothing is cached, and there is no fallback to a committed list. See [GM command console & audit trail](#gm-command-console--audit-trail).

## Game accounts

Creating and linking a game account lives in [`src/lib/server/accounts/`](src/lib/server/accounts):

- **Creation goes through the worldserver**, the way the official procedure describes it: the site runs
  `account create <username> <password> <email>` over the console (SOAP), so the server computes the SRP6
  salt and verifier itself. The email argument is **the signed-in Discord address, never a form field**
  (the command treats it as optional; we always send one). The only table this project owns is the
  `game_account` mapping in [`schema.ts`](src/lib/server/db/schema.ts).
- **Linking is the legacy path, and the email decides first.** An account that already carries the
  visitor's Discord address is theirs by definition, so the account name alone links it. For an account
  whose email is empty or belongs to someone else, the account's own password is checked against the
  `salt` and `verifier` on the `acore_auth.account` row — the same check the auth server makes at logon,
  and it never changes the password. One message covers both failures on purpose, so the form cannot be
  used to probe which names exist.
- **The SRP6 check is transcribed, not invented.** [`srp6.ts`](src/lib/server/accounts/srp6.ts) documents
  the two details that make it work — the game's own `N` and `g`, and `BigNumber`'s little-endian default
  for both the digest and the stored verifier. Getting either wrong can only deny a valid attempt, never
  grant an invalid one.
- **One write into AzerothCore's database.** After a link is recorded, the account's email is set to the
  Discord address — one column of one row — so the two agree from then on and the account is reachable
  through the profile that owns it. It is best-effort: the link stands if the write fails, and it cannot be
  rolled back anyway, because the two databases cannot share a transaction. This is the only place the
  project mutates a row AzerothCore owns.
- **The accounts page lists the realm's accounts by email**, then folds in anything already linked
  ([`listPlayerAccounts()`](src/lib/server/accounts/service.ts)). AzerothCore is the source of truth here:
  an account carrying the player's Discord address is theirs whether or not this site created it, which is
  why **unlinking does not remove a row from that list** — it only clears the recorded claim, while the
  account keeps its address. `account.email` has **no index** in AzerothCore's schema, so that lookup is a
  table scan; fine at private-realm account counts, and adding an index would be a DDL change on a
  database this project does not own.
- **Rules** ([`rules.ts`](src/lib/server/accounts/rules.ts)) mirror the server's limits
  (`MAX_ACCOUNT_STR` 17, `MAX_PASS_STR` 16, `MAX_EMAIL_STR` 255) and add two of ours: alphanumeric
  usernames, and no
  whitespace in a _new_ password — both because the value is interpolated into a space-delimited console
  command. Passwords for _existing_ accounts are deliberately left unconstrained, because they are hashed
  and never sent to a console.
- **The two steps are not transactional.** MySQL cannot commit across `acore_manager` and `acore_auth`, so
  an account can exist on the realm without being linked. That state is recoverable by design: the link
  form is the repair path, and the failure message says so.
- **Unlinking deletes the mapping row only.** The game account, its characters and its password are
  untouched. Deleting an account is a server operation with consequences the UI cannot undo, so it is not
  offered.

## Characters

Characters are **read-only**, from `acore_characters` in
[`src/lib/server/characters/`](src/lib/server/characters):

- **Two pages, one ownership proof.** `/accounts/[username]` lists an account's characters and the ones it
  has deleted; `/accounts/[username]/characters/[guid]` opens one. The account name in the URL is a claim,
  not a permission: [`requireOwnedAccount()`](src/lib/server/authz.ts) proves it, and the guid is then
  looked up **scoped to that account** — a guid is a small integer, so counting upwards must never be a way
  to read somebody else's character.
- **Names come from the server, never from a list kept here.** Race, class, zone, skill and item names are
  read out of `acore_world` — `chrraces_dbc`, `chrclasses_dbc`, `areatable_dbc`, `skillline_dbc`,
  `itemdisplayinfo_dbc` and `item_template` — because the client renders those same tables. A hardcoded list
  would drift from what players see the moment a custom race or a renamed skill exists.
- **Deleted characters are a feature, not a leak.** AzerothCore does not remove a deleted character: it
  moves the identity aside into `deleteInfos_Name` / `deleteInfos_Account` / `deleteDate` and blanks `name`
  and `account`. The list therefore filters on `deleteInfos_Account` and reads the name back — a query
  against `account` returns nothing at all, which is the kind of bug that looks like an empty list.
- **Nothing on those pages acts.** No console command and no write: changing a character is deliberately
  not built yet. The audit trail such an action would have to write to exists now (see
  [GM command console & audit trail](#gm-command-console--audit-trail)); the action itself does not.
- **Item icons are the one thing not in a database.** `itemdisplayinfo_dbc` gives the icon's _name_, but the
  image is a texture inside the client's MPQ archives, so the extracted files live in
  `static/interface/Icons` and are served from this site — a player's browser fetches item icons here and
  nowhere else (see [`.env.example`](.env.example) for the one override). **The name is used verbatim and
  must never be normalised:** the client's own DBC is inconsistently cased, so `INV_Sword_106` really does
  sit beside `INV_SWORD_107`, and the extracted files match it exactly. Lowercasing the name would 404 most
  icons on a case-sensitive filesystem, which is what the container runs on.
- **A realm may have no icon names at all.** `itemdisplayinfo_dbc` is the world database's mirror of the
  client's `ItemDisplayInfo.dbc`, and AzerothCore's base SQL ships it **empty** — `LOAD_DBC` takes both the
  `.dbc` file and the table name, so a worldserver reads the file from its own data directory and a realm
  never needs the table populated. When it is empty, every item icon falls back to the placeholder, and the
  app logs one warning naming the cause rather than looking broken in silence.
- **Filling that table is a realm-owner task, and it is documented.** AzerothCore's own guide,
  [How to import DBC data in the DB](https://www.azerothcore.org/wiki/how-to-import-dbc-data-in-db), uses
  [`node-dbc-reader`](https://github.com/wowgaming/node-dbc-reader) against the client's `.dbc` files to
  emit `INSERT` statements for those tables. This project **never writes into `acore_world`** — it only
  reads — so an unpopulated table is fixed on the realm, not here.
- **Skills are listed flat.** The world database ships no `skilllinecategory_dbc`, so nothing authoritative
  separates professions from weapon and language skills. Ordering by value puts trained professions first; a
  curated split would need a verified list of profession ids.

## GM command console & audit trail

The console at [`/staff/moderator/commands`](<src/routes/(staff)/staff/moderator/commands>) lists every command
the realm declares and runs the ones the acting profile may run; [`/staff/admin/audit`](<src/routes/(staff)/staff/admin/audit>)
shows every attempt, newest first. Three modules carry it:

- **Catalogue** — [`src/lib/server/acore/commands.ts`](src/lib/server/acore/commands.ts): one read-only `SELECT` on
  `acore_world.command`, mapped by the pure `toCommandEntry()`. `readCommandCatalogue()` returns
  `{ entries, available }`, and `findCommand()` looks one up by name for the action.
- **Vocabulary and policy** — [`src/lib/gm-commands.ts`](src/lib/gm-commands.ts), client-safe: the `GmCommand` shape,
  `parseHelp()`, `groupOf()`, `tierForCommandLevel()`, `isRunnable()`, `requiresConfirmation()`, `noteFor()`, the risk
  vocabulary and the curated deny list, plus `MAX_AUDIT_OUTPUT_CHARS` (2000) and `MAX_COMMAND_ARGUMENTS` (200).
- **Execution** — [`src/lib/server/commands/`](src/lib/server/commands): the audited runner
  ([`audit.ts`](src/lib/server/commands/audit.ts)) and the console-line rules ([`rules.ts`](src/lib/server/commands/rules.ts)).
  The `run` action in [`.../commands/+page.server.ts`](<src/routes/(staff)/staff/moderator/commands/+page.server.ts>)
  holds the checks and calls the runner; nothing else sends a command.

**The catalogue is the realm's own `acore_world.command` table, never a list kept here.** The table's `security`
column is authoritative because the core adopts it as each command's required level at boot, so a gate built on
the realm's number matches what the realm asks of an in-game caller, and a realm that has retuned a command is
respected rather than contradicted. This site keeps **no per-command security number** and has **no fallback
list**. Nothing is cached: the table is read afresh on every request, the rule the GM level and the character
reference tables already follow. The query needs one grant — `SELECT` on `acore_world.command` — listed in
[`.env.example`](.env.example) with the other narrow reads.

**What is runnable, and what is only listed.** `isRunnable()` accepts a command whose `security` is 1–3 when the
overlay does not block it. Level 0 is excluded outright, because through this site's console credential those
player self-service commands would act on the console account rather than on the caller. Level 4 is **listed and
never runnable**: the site's ladder stops at `administrator`, so `tierForCommandLevel()` returns `null` above it
rather than clamping to the top tier and claiming the site can run it. The overlay is **restrict-only by
construction** — it can block a command or demand a typed confirmation, and an unclassified command is
`mutating`, never `read-only` — so it can never declare runnable something the realm gates more strictly.

**When the table cannot be read, everything closes.** An unreadable table (`ACORE_DATABASE_URL` unset, MySQL
down, no `SELECT` grant) makes the catalogue _unavailable_: nothing is listed, nothing is runnable, no fallback
stands in for the realm, and the failure is logged on every occurrence. A table that reads but holds no usable
row shows the same empty console and is logged **once per process**, because an empty table is a property of that
realm — AzerothCore ships it in `data/sql/base/db_world/command.sql`, and this project never writes into
`acore_world`. A command the core knows but the table does not is absent from the catalogue and therefore not
runnable: the name **is** the whitelist, and it fails closed.

### Execution, and the rule that makes it safe

The `run` action re-checks everything, in this order, because a layout does not cover an action:

1. `getAccess(locals)`, then `requireStaff()`. The site's SOAP credential is an administrator, so without this
   line any POST would spend it whatever tier the sender had.
2. Read the catalogue and look the submitted **name** up; not found ⇒ 404. The submitted value is a lookup key,
   never a fragment of a console line — the line is built from the catalogue's own name.
3. Not `runnable` (level 0, above the ladder, or blocked) ⇒ a `refused` audit row, then 403 carrying the entry's
   own note.
4. `requireCommandLevel(access, entry.security)` ⇒ refusal recorded, then 403.
5. `validateCommandArguments()` and the typed confirmation, both validated **on the server** whatever the form
   did: a control character, a value over `MAX_COMMAND_ARGUMENTS`, or arguments for a command whose syntax
   declares none is refused, and a forged POST that omits the confirmation is refused _and recorded_.
6. `runAuditedCommand()` — the only thing that sends anything.

**The trail is written in two phases, and no transaction spans the SOAP call.** The intent row
(`status = 'pending'`) is inserted _before_ anything reaches the worldserver; the outcome (`success` or `failed`,
with `failure_reason`, `message`, `output`, `duration_ms` and `finished_at`) updates that same row afterwards.
`executeCommand()` returns a result rather than throwing, so success and failure take one uniform path and a
failed execution is recorded exactly like a successful one. Holding a MySQL transaction open across a call that
can run for the client's ten-second timeout would pin a pool connection and hold locks to protect nothing.

- **No trail, no action.** If the intent insert fails, nothing is sent, and the operator is told the trail is
  unavailable (503). An action with no record is worse than an action that did not happen.
- **The outcome write can fail after the command has already run.** There is no undo, so the whole outcome goes to
  the log — the log becomes the fallback record — and the page says the command ran and could not be recorded
  rather than showing an unqualified success.
- **A refusal is its own row**, written before the 403 leaves, because a moderator posting a command above their
  level is exactly the event worth having in the record. Unlike a run, refusing does not depend on the trail being
  writable.
- **A `pending` row with no `finished_at` means the process died** between sending the command and recording the
  outcome. The trail renders it as that: not a failure, and not evidence that nothing happened.

### `command_audit`

Declared in [`schema.ts`](src/lib/server/db/schema.ts), migrated by
[`0002_quick_jack_murdock.sql`](drizzle/0002_quick_jack_murdock.sql).

- **`user_id` has no foreign key to `user`, deliberately.** A cascade would erase the history of a deleted
  profile — the opposite of what an audit trail is for — so the column is a plain indexed id, and `actor_name`
  and `actor_level` are denormalised so a row survives a rename or a deletion. Do not "fix" this.
- **Append-only, with no retention tooling.** One row per execution is negligible at private-realm staff volumes,
  the app has no scheduler in which a prune could run, and nothing in the codebase or the UI edits, deletes,
  prunes or exports a row — the trail page exports no actions at all.
- **`status` and `failure_reason` are varchars, not enums.** The statuses are fixed, but the reasons mirror
  `SoapFailureReason`, which grows, and adding an enum value would be a DDL change.
- **`output` is truncated at `MAX_AUDIT_OUTPUT_CHARS` (2000) by the writer**, so a long reply loses its tail in
  the table and on both pages, which name the limit rather than letting the text appear to end by itself.
- **The trail page reads one page at a time** (`AUDIT_PAGE_SIZE`, 50, selected with `?page=`) and never counts
  the table: `hasMore` comes from reading one row past the page, so a page render is one index-ordered scan.

**What the console is not.** A command runs as the site's own console account, so what it does is bounded by what
the realm lets _that_ account do — not by the visitor's in-game standing. A command that needs a selected player
or creature cannot work from a console at all: it runs, the console answers with an error, and the operator and
the trail both see the console's own words. This is not a free-text console either — the catalogue is a whitelist
on purpose — and the telnet remote console is a different surface entirely (see [Roadmap](#roadmap), item 5).

## Auth architecture

- The Better Auth instance is [`src/lib/server/auth.ts`](src/lib/server/auth.ts); it is wired into requests through [`src/hooks.server.ts`](src/hooks.server.ts), and ambient types live in [`src/app.d.ts`](src/app.d.ts).
- The auth tables are the generated ones in `auth.schema.ts`, re-exported alongside the project schema.
- **Sign-in is Discord only.** [`src/routes/(public)/login/`](<src/routes/(public)/login>) posts to a form action that asks Better Auth for the Discord authorization URL and redirects the browser to it. The scaffold's email/password demo has been deleted.
- The Discord application must list this redirect URI: `<ORIGIN>/api/auth/callback/discord`.
- **Authorization is tiered, and it has one home.** [`src/lib/server/authz.ts`](src/lib/server/authz.ts) decides access: `requireUser()` for the `(authenticated)` group, `requireStaff()` for `/staff`, `requireGameMaster()` / `requireServerManager()` for the folders beneath it, and `requireCommandLevel()` for one command's own level — a route's floor and a command's level answer different questions. The level is read from `acore_auth` on every request and never cached — see [The tier ladder](#the-tier-ladder). Do not add per-route checks elsewhere. (Note: this is not the Better Auth `admin` plugin; roles are not stored on `user`, because permissions come from AzerothCore.)

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

## Scaffold placeholders — all removed

Everything `sv create` left behind is gone: the `/demo` routes, the `pine` theme, the unwired UI stack
and [`src/lib/vitest-examples/`](src/lib/vitest-examples).

- The Playwright smoke test that pointed at `/demo` now covers the public landing page ([`src/routes/(public)/page.e2e.ts`](<src/routes/(public)/page.e2e.ts)).
- Real specs replaced `vitest-examples`, so both `npm run test:unit -- --run` and `playwright test` have files to match — see [`src/lib/access.spec.ts`](src/lib/access.spec.ts) and [`src/lib/server/staff-routes.spec.ts`](src/lib/server/staff-routes.spec.ts).
- The `azeroth` theme replaced the placeholder theme.

## Known issues

- **Staff access needs a linked game account.** A staff member who has not linked one has no level to
  read, so the staff area stays closed to them until they do — see
  [Route groups & authorization](#route-groups--authorization).
- **`account_access` changes land here before they land in game.** The site reads the table directly,
  while the worldserver keeps its own copy in memory until it reloads.
- **The UI is dark by default.** `app.html` adds `.dark` unless the visitor opted into light mode;
  nothing follows `prefers-color-scheme`.
- **`/staff/gm` is still read-only, and the command box sits elsewhere.** That page runs `.server info` and
  nothing else. The console is at `/staff/moderator/commands`, and it is not a free-text box: the realm's own
  catalogue is the whitelist, and every attempt is audited.
- **The site's own check is the enforcement point.** The worldserver's SOAP credential is an administrator, so
  the server runs whatever the site sends it; what stops a moderator from running a level-3 command is
  `requireCommandLevel()` in the console's action, which fails closed on a level it could not read.
- **The catalogue is only as good as the realm's table.** A row carrying the wrong `security` is gated by that
  number, because the core adopts the same column for its own callers. Populating or correcting `command` is a
  realm task — this project only reads it — and an empty table leaves nothing runnable.
- **Console-capability is not in the table.** AzerothCore admits a console caller by an `AllowConsole` flag the
  table does not carry, so a command that needs a selected player or creature cannot work from here: it runs,
  the console answers with an error, and the trail records that error rather than a result.
- **The site's ladder stops at `administrator`.** A level-4 command is listed for reference and is never
  runnable, because this site is not a console account.
- **Console output is truncated at 2000 characters.** A long reply has lost its tail in the trail and on both
  pages, and the missing text was never written down anywhere.
- **`/staff/admin` is no longer a placeholder.** It hosts the audit trail, gated at `SEC_ADMINISTRATOR` by the
  folder's own layout; the rest of what belongs at that tier is roadmap item 4.
- **The icon textures are not in the repository, and not in the image.** `static/interface` is excluded by
  both [`.gitignore`](.gitignore) and [`.dockerignore`](.dockerignore), because the artwork is Blizzard's and
  this repository is not a distribution channel for it. Nothing breaks: an icon that cannot be fetched
  renders as a placeholder rather than a broken image, so a deployment without the files shows no pictures
  until they are mounted in or `ICON_BASE_URL` points at a host that has them.
- **A deleted character stays visible to the account that deleted it.** That is the point of the view, but
  it also means a character removed for a reason that was meant to be decisive is still listed to its owner
  until AzerothCore prunes it.
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
- [`.dockerignore`](.dockerignore) — keeps `.env`, `node_modules` **and `static/interface`** out of the build
  context. The first matters because `COPY . .` would otherwise bake real credentials into an image layer;
  the last is deliberate too, so the extracted client textures are not distributed inside an image. A
  deployment that wants icons has to supply them itself — mounting them under the runtime's
  `build/client/interface` directory, or pointing `ICON_BASE_URL` at a host that serves them.

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
   `(public)` / `(authenticated)` / `(staff)` groups and the centralized `authz` helper.
2. **Game accounts — create and link.** _Done_ — creation runs the worldserver's own `account create`
   over SOAP, linking verifies the account's password against the credentials stored in `acore_auth`, and
   `game_account` records the result against a profile (migrated in
   [`0001_awesome_tombstone.sql`](drizzle/0001_awesome_tombstone.sql)). Remaining: decide what staff
   tooling should exist around a link — who may detach one, and what happens to the account.
3. **Close the authorization gate.** _Done_ — `gmlevel` is read from `acore_auth.account_access` for the
   profile's linked game accounts, and each folder under `/staff` enforces its own floor. Remaining: per-realm
   scoping, should a realm model ever exist.
4. **Characters, bans and live operations.** _Console done, the rest open_ — an account's characters, their
   equipment and their skills are readable at `/accounts/[username]`, including the characters the account
   has deleted, and the console at `/staff/moderator/commands` runs the realm's own commands with every
   attempt recorded in `command_audit` ([`schema.ts`](src/lib/server/db/schema.ts), migrated by
   [`0002_quick_jack_murdock.sql`](drizzle/0002_quick_jack_murdock.sql)). Remaining: bans and mutes as
   first-class tools, the staff-facing view of any player, and every other action that changes a live realm
   (unstuck, rename). The rule is unchanged — an action stays unbuilt until it has an audit trail — and the
   console satisfies it for console commands specifically, not for actions that would need a record of their
   own.
5. **AzerothCore integration rules.** What already applies is in
   [AzerothCore integration](#azerothcore-integration). Before adding features on top: the auth and world
   servers do not communicate with each other at all — they are coupled only through `acore_auth` — and
   the telnet remote console on port 3443 grants the same command execution as SOAP and must never be
   exposed to the browser.

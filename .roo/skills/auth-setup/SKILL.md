---
name: auth-setup
description: Use when working with authentication — Better Auth configuration, sessions, protected routes, auth UI, plugins, or regenerating the auth schema tables.
---

# Auth Setup

## When to use

- Adding or editing the Better Auth configuration or its plugins.
- Protecting routes or reading the session server-side.
- Building auth UI (sign-in/sign-up) or replacing the scaffold's demo auth pages.
- Regenerating the auth tables after a Better Auth upgrade or a config change.

## When NOT to use

- Schema changes unrelated to the auth tables — use `database-workflow`.
- Purely visual work on auth screens — use `ui-development` once the wiring is in place.

## References

- [`llms/betterauth/llms.txt`](../../../llms/betterauth/llms.txt) — Better Auth docs:
  - Setup: `Installation`, `Basic Usage`
  - Adapter: `Adapters` → `Drizzle ORM Adapter` (**this project uses MySQL**, so the MySQL section applies — not the PostgreSQL one)
  - Concepts: `Database` (core schema `user`/`session`/`account`/`verification`), `Session Management`, `CLI`, `Cookies`, `API`, `Hooks`, `Plugins`, `TypeScript`
  - Integration: `Integrations` → `SvelteKit Integration`
  - Options: `Reference` → `Options`
- [`AGENTS.md`](../../../AGENTS.md) → Auth architecture, Database workflow.
- [`src/lib/server/auth.ts`](../../../src/lib/server/auth.ts) — the Better Auth instance.
- [`src/hooks.server.ts`](../../../src/hooks.server.ts) — where auth is wired into requests.
- [`src/app.d.ts`](../../../src/app.d.ts) — ambient types, including `App.Locals`.
- [`src/lib/server/db/auth.schema.ts`](../../../src/lib/server/db/auth.schema.ts) — the **generated** `user`/`session`/`account`/`verification` tables.
- [`src/routes/(public)/login/`](<../../../src/routes/(public)/login>) — the sign-in route: a form action that asks Better Auth for the Discord authorization URL and redirects to it, after sanitising `redirectTo` through `safeRedirectTarget()`.
- [`src/lib/server/authz.ts`](../../../src/lib/server/authz.ts) — the authorization helpers the route groups call.
- [`src/lib/auth-client.ts`](../../../src/lib/auth-client.ts) — the browser client (sign-out today, provider linking later).

## Key facts

- **The only sign-in provider is Discord.** `getAuth()` configures `socialProviders.discord` from `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`; `emailAndPassword` is **not** enabled. The Discord application must list `<ORIGIN>/api/auth/callback/discord` as a redirect URI.
- **Core schema** is `user`, `session`, `account`, `verification` — the tables in `auth.schema.ts`. It is **generated**: regenerate with `npm run auth:schema` and never hand-edit it.
- **Drizzle adapter** points at this project's MySQL Drizzle client. The adapter's `provider` must match the database dialect (`mysql`), not `pg`/`postgresql`.
- **SvelteKit integration:** the `sveltekitCookies` plugin must remain the **last** entry in the plugins array, and the handler is wired through `src/hooks.server.ts`.
- **Server-side session access:** read the session from `event.locals` in server code (types in `src/app.d.ts`); hooks populate it. The root `+layout.server.ts` narrows it to `CurrentUser` (`src/lib/user.ts`) for the UI — never hand a raw Better Auth record to a page.
- **Sign-out is client-side:** `authClient.signOut()` from `src/lib/auth-client.ts`, then `invalidateAll()` before navigating, because the session is read by hooks on every request.
- The `auth:schema` script runs the Better Auth CLI against `src/lib/server/auth.ts` and writes `src/lib/server/db/auth.schema.ts`.
- **The CLI needs the module to expose `auth.options`.** `getAuth()` is the app's entry point, but the CLI reads `export const auth` (or a default export) and then uses `.options` off it. `src/lib/server/auth.ts` therefore exports `auth` as a plain object with an `options` getter that calls `getAuth()`. It cannot be a `Proxy`: the CLI loads the config through `c12`, which merges the loaded value with `defu`, and `defu` copies own enumerable properties only — a proxy over an empty target is flattened to `{}` and the CLI reports that it could not read the config.
- `auth.schema.ts` is listed in `.prettierignore`: the CLI writes its own formatting (2-space indents, double quotes), so `npm run lint` would fail on every regeneration otherwise.

## Steps

1. Read `AGENTS.md` → Auth architecture, then the matching section of `llms/betterauth/llms.txt` for the feature you are adding.
2. Configure or extend the instance in `src/lib/server/auth.ts`.
3. After changing the auth config, regenerate the tables: `npm run auth:schema`, then `npm run db:generate` and `npm run db:migrate`.
4. Read the session server-side in `+page.server.ts` / `+server.ts` / hooks; pass only what the UI needs to the page.
5. Verify once at the end: `npm run check`, then the relevant tests.

## Rules

- Construct the auth instance **lazily** through `getAuth()`, never at module scope — the build must stay DB-free.
- `sveltekitCookies` stays last in the plugins array.
- Auth tables are generated; treat `auth.schema.ts` as build output, not as source.
- Keep auth code in `src/lib/server/`; never import it from client-side component code.
- **Authorization is tiered, and it has exactly one home:** `src/lib/server/authz.ts`. It resolves the GM
  level from `acore_auth.account_access` across the profile's linked game accounts and compares tiers:
  `requireUser()` for the `(authenticated)` group, `requireStaff()` for `/staff`, and
  `requireGameMaster()` / `requireServerManager()` for the folders beneath it. Change the rule there,
  never per route.
- **An action checks for itself.** SvelteKit runs a form action before the page's load functions, so a
  layout's 403 arrives too late to stop one — a gated action calls a `require*` helper at the top.
- **Do not add roles to the `user` table.** This project does not use Better Auth's `admin` plugin;
  permissions are meant to come from AzerothCore, not from the auth schema.

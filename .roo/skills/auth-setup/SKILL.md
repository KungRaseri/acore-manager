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
- [`src/routes/demo/better-auth/`](../../../src/routes/demo/better-auth) — the scaffold's demo sign-in flow (a placeholder, not the real auth UX).

## Key facts

- **Core schema** is `user`, `session`, `account`, `verification` — the tables in `auth.schema.ts`. It is **generated**: regenerate with `npm run auth:schema` and never hand-edit it.
- **Drizzle adapter** points at this project's MySQL Drizzle client. The adapter's `provider` must match the database dialect (`mysql`), not `pg`/`postgresql`.
- **SvelteKit integration:** the `sveltekitCookies` plugin must remain the **last** entry in the plugins array, and the handler is wired through `src/hooks.server.ts`.
- **Server-side session access:** read the session from `event.locals` in server code (types in `src/app.d.ts`); hooks populate it.
- The `auth:schema` script runs the Better Auth CLI against `src/lib/server/auth.ts` and writes `src/lib/server/db/auth.schema.ts`.

## Steps

1. Read `AGENTS.md` → Auth architecture, then the matching section of `llms/betterauth/llms.txt` for the feature you are adding.
2. Configure or extend the instance in `src/lib/server/auth.ts`.
3. After changing the auth config, regenerate the tables: `npm run auth:schema`, then `npm run db:generate` and `npm run db:migrate`.
4. Read the session server-side in `+page.server.ts` / `+server.ts` / hooks; pass only what the UI needs to the page.
5. Verify once at the end: `npm run check`, then the relevant tests.

## Rules

- Construct the auth instance **lazily** (on first use), never at module scope — the build must stay DB-free.
- `sveltekitCookies` stays last in the plugins array.
- Auth tables are generated; treat `auth.schema.ts` as build output, not as source.
- Keep auth code in `src/lib/server/`; never import it from client-side component code.
- **Authorization is not designed yet.** There is no role or permission model in this project — do not
  invent admin/moderator concepts without deciding the model deliberately first, and do not assume
  anything from a previous project's auth scheme exists here.

---
name: repo-context
description: Use when starting any work in this repository or when you need to orient yourself — project structure, the single SvelteKit app layout, commands, environments, and conventions.
---

# Repo Context

## When to use

- Beginning a new task in the repository.
- Unsure where a given piece of code belongs.
- Need the correct command to build, check, test, or lint a change.
- Reading unfamiliar code and want the architecture in one place.

## When NOT to use

- Task-specific workflows — pick the matching skill once you know what the work touches: `database-workflow`, `auth-setup`, `sveltekit-development`, `ui-development`, `verification`, `new-feature`.

## References

- [`AGENTS.md`](../../../AGENTS.md) — authoritative reference: layout, commands, env, DB/auth workflow, UI rules, conventions.
- [`README.md`](../../../README.md) — project overview, setup, and roadmap.
- [`package.json`](../../../package.json) — the real scripts and dependencies (the only trustworthy command list).
- [`drizzle.config.ts`](../../../drizzle.config.ts) — schema path and MySQL dialect.
- [`vite.config.ts`](../../../vite.config.ts) — build config plus the two Vitest projects (jsdom `client` + node `server`).
- [`playwright.config.ts`](../../../playwright.config.ts) — e2e config and preview port.
- [`src/lib/server/db/schema.ts`](../../../src/lib/server/db/schema.ts) — schema source of truth.

## Key facts

- **Single SvelteKit application**, `acore-manager`. It is **not a monorepo**: there are no workspaces,
  so `--workspace <name>` flags fail, and there is no `typecheck` or `coverage` script.
- `src/routes/` — routes (pages, `+page.server.ts` loads and actions).
- `src/lib/server/` — **server-only** code: `auth.ts` (Better Auth), `db/` (Drizzle client + schema).
- `src/routes/layout.css` — Tailwind 4 entry point. There is **no `tailwind.config.js`** (Tailwind 4 is CSS-first).
- `src/hooks.server.ts` — SvelteKit server hooks; `src/app.d.ts` — ambient types; `src/app.html` — HTML shell.
- One **`.env` at the repository root** — not per-workspace files.
- Stack: SvelteKit 2 + Svelte 5 runes, TypeScript strict/ESM, Tailwind 4, Skeleton v5 + Bits UI +
  Lucide + Simple Icons (installed, **not yet wired**), Drizzle ORM + drizzle-kit on **MySQL**
  (`mysql2`), Better Auth, Vite 7, Vitest 3 (`client` jsdom + `server` node projects), Playwright (e2e).
- Commands: `dev`, `build`, `preview`, `check` (the type gate), `lint`, `format`, `test:unit`
  (**watch mode** — pass `-- --run`), `test`, `test:e2e`, `db:push|generate|migrate|studio`, `auth:schema`.
- **Status: early scaffolding.** `src/routes/demo/**` and `src/lib/vitest-examples/**` are scaffold
  placeholders, not features.
- **No AzerothCore integration exists yet** — accounts, GM levels, characters, bans and live operations
  are all unbuilt and deliberately deferred.

## Steps

1. Read [`AGENTS.md`](../../../AGENTS.md) in full — it is the authoritative reference for this repo.
2. Identify which area the task touches: routes/pages, server-only logic, database, auth, or UI.
3. Activate the matching skill rather than working from this one.
4. Verify once, at the end of the session: `npm run check` and `npm run lint` (plus the relevant tests).

## Rules

- Never import anything from `src/lib/server/**` into client-side component code.
- Keep the Drizzle client and the Better Auth instance lazily constructed, so `vite build` never needs a
  live database.
- Batch your edits, then verify once at the end of the session — do not run check/lint after every change.
- Check claims about third-party libraries against `llms/` or the installed package before repeating
  them; several inherited documents describe versions this project does not have.
- Do not reintroduce content from the project this scaffold was copied from (another product's naming,
  a monorepo layout, a game engine, or a WebSocket/room framework). Treat such leftovers as bugs.

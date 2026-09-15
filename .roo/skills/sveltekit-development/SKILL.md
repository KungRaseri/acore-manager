---
name: sveltekit-development
description: Use when building or changing SvelteKit routes, pages, layouts, components, Svelte 5 runes, form actions, SSR, environment access, or the build/adapter config.
---

# SvelteKit Development

## When to use

- Creating routes (`+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+server.ts`, load functions).
- Writing Svelte 5 components (this project forces runes mode).
- Implementing forms/actions, SSR, or reading environment variables.
- Changing the build config (`vite.config.ts`, adapter, Vite settings).

## When NOT to use

- Visual design, styling, or Skeleton/Bits UI/Lucide component work — use `ui-development`.
- Schema or migration changes — use `database-workflow`. Auth wiring — use `auth-setup`.

## References

- [`llms/sveltekit/llms-full.txt`](../../../llms/sveltekit/llms-full.txt) — official Svelte 5 + SvelteKit docs:
  - Svelte runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`, `$inspect`, `$host`
  - Markup blocks: `{#if}`, `{#each}`, `{#key}`, `{#await}`, `{#snippet}`
  - SvelteKit: `Routing`, `Loading data`, `Form actions`, `Page options`, `Environment variables`, `Adapters`, `Hooks`, `Server-only modules`
- [`llms/vite/llms-full.txt`](../../../llms/vite/llms-full.txt) — `Features` (HMR), `Configuring Vite`, `Building for Production`.
- [`llms/tailwindcss/llms.txt`](../../../llms/tailwindcss/llms.txt) — Tailwind v4, CSS-first `@theme`/`@utility`/`@variant`.
- [`AGENTS.md`](../../../AGENTS.md) → Tech stack, Environment & setup, Auth architecture.
- [`vite.config.ts`](../../../vite.config.ts) — the SvelteKit plugin (runes forced for non-`node_modules` files), adapter, and the two Vitest projects.
- [`src/routes/`](../../../src/routes) — existing routes (only scaffold demos so far).
- [`src/lib/server/`](../../../src/lib/server) — server-only code (`auth.ts`, `db/`).

## Key facts

- **This is a single SvelteKit app at the repository root.** Routes live in `src/routes/`, not `client/src/routes/`. There are no workspaces, so `--workspace <name>` flags are invalid.
- **Svelte 5 runes** are compiler keywords — no import needed:
  - `$state` → deeply reactive proxies; `$state.raw` (reassign-only), `$state.snapshot` (unproxy).
  - `$derived` / `$derived.by` → derived values; keep the expressions free of side effects.
  - `$effect` → browser only (never runs during SSR); may return a teardown function. **Don't set state inside effects** — prefer `$derived`.
  - `$props` → destructure with fallbacks; `$bindable` for two-way bound props.
- **Runes mode is forced** for every file outside `node_modules` by the `compilerOptions.runes` function in [`vite.config.ts`](../../../vite.config.ts). Do not write legacy `export let` / `$:` syntax.
- **Adapter is `@sveltejs/adapter-node`.** The app is deployed as a Node server (see `Dockerfile`), where
  the runtime entrypoint is `node build/index.js`. Set `ORIGIN` to the browser-facing origin, or
  adapter-node rejects cross-origin form submissions. There is no mdsvex in this project.
- **Environment:** a single `.env` at the repository root. Import variables server-side through `$env/dynamic/private` (or `$env/static/private` for build-time constants) and only from server-only code.
- **Server-only modules:** `$env/*/private` and `$lib/server` may only be imported by server-only code — `hooks.server.*`, `+page.server.*`, `+server.*`, `*.server.*`, or within `$lib/server` itself. SvelteKit fails the build if public-facing code reaches them, even indirectly.
- **Tailwind v4 is CSS-first:** there is no `tailwind.config.js`. The entry point is [`src/routes/layout.css`](../../../src/routes/layout.css).
- **Vitest projects** (see `vite.config.ts`): a `client` browser project picks up `src/**/*.svelte.{test,spec}.{js,ts}` (excluding `src/lib/server/**`), and a `server` node project picks up `src/**/*.{test,spec}.{js,ts}` (excluding the Svelte specs). `expect.requireAssertions` is **on**, so every test must contain at least one assertion.
- **Playwright e2e files are matched by `**/*.e2e.{ts,js}`** and run against the preview server on port 4173.

## Steps

1. Read the relevant section of `llms/sveltekit/llms-full.txt` before writing runes or SvelteKit code.
2. Follow the patterns already present in `src/routes/` and `src/lib/`.
3. Keep database and auth imports server-side in `src/lib/server/`, constructed lazily.
4. Verify once at the end of the session: `npm run check`, then `npm run test:unit -- --run`, then `npm run build`.

## Rules

- Never import `src/lib/server/**` or `$env/*/private` from client-side component code.
- Don't construct the database or auth clients at module scope — the build must stay DB-free.
- Prefer `$derived` over `$effect` for derived values, and never mutate props (use `$bindable`).
- Use keyed `{#each}` blocks for lists, and `{#snippet}` + `{@render}` for reusable markup.
- Remember that the browser Vitest project needs Playwright's Chromium installed (`npx playwright install chromium`).

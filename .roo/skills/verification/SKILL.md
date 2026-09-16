---
name: verification
description: Use before finishing ANY change to this repo — run check (svelte-check), lint, tests, and build to confirm nothing is broken.
---

# Verification

## When to use

- Before declaring any task complete.
- After any change to routes, components, server-only code, the schema, or config.
- Whenever you are unsure whether a change compiles or broke tests.

## When NOT to use

- As a substitute for the workflow skills, and never in the middle of a change session — batch all
  edits first, then run these gates **once** at the end (see `AGENTS.md` → Conventions).

## References

- [`llms/vitest/llms-full.txt`](../../../llms/vitest/llms-full.txt) — `Getting Started`, `Configuring Vitest`, `Command Line Interface`, `Mocking`, `Environment`. The corpus also documents `Browser Mode` and coverage: **this project uses neither** (unit tests run in jsdom, and there is no coverage gate).
- [`llms/vite/llms-full.txt`](../../../llms/vite/llms-full.txt) — `Configuring Vite`, `Building for Production`, `Features` (HMR).
- [`AGENTS.md`](../../../AGENTS.md) → Commands, Conventions.
- [`package.json`](../../../package.json) — the authoritative script list.
- [`vite.config.ts`](../../../vite.config.ts) — the two Vitest projects (a jsdom `client` project and a node `server` project) and `expect.requireAssertions`.
- [`vitest-setup-client.ts`](../../../vitest-setup-client.ts) — registers `@testing-library/jest-dom/vitest` for the client project; [`src/vitest.d.ts`](../../../src/vitest.d.ts) exposes the same matchers to `svelte-check`.
- [`playwright.config.ts`](../../../playwright.config.ts) — e2e matching (`**/*.e2e.{ts,js}`) and the preview port.

## Steps

Run from the repository root, once, at the end of the session:

1. `npm run check` — `svelte-kit sync` + `svelte-check`. **This is the type gate.** There is no
   `typecheck` script; do not reach for one.
2. `npm run lint` — `prettier --check .` followed by `eslint .`. If formatting is the only failure,
   `npm run format` fixes it — but format only the files you touched if the rest of the tree is
   already clean.
3. `npm run test:unit -- --run` — Vitest, both projects (jsdom `client`, node `server`). **`--run` is
   mandatory outside interactive use**, because the underlying script is `vitest` in watch mode and will
   otherwise hang. This step downloads no browser.
4. `npm run test` — unit tests plus e2e. Only needed when the change can affect rendered pages.
5. `npm run build` — the production build. Do not skip this: see the caveat below.

## Caveats that cost real debugging time

- **Vitest does not enforce SvelteKit's server-only import rule.** A component that imports
  `$lib/server` or `$env/*/private` can pass unit tests and only fail at `npm run build`. That is why
  the build is part of verification even when tests are green.
- **`expect.requireAssertions` is on**, so a test with no assertion fails rather than silently passing.
- **Unit tests run in jsdom, not a real browser.** `npm run test:unit` needs no Chromium and no
  `npx playwright install`. Playwright browsers are only needed by the **e2e** suite, and
  `npm run test:e2e` installs them itself (CI installs `--with-deps chromium`).
- **Component specs render through `@testing-library/svelte`**, and in v5 the props object is the
  **second** argument: `render(Component, { ...props })`. Passing props first renders an empty component
  and the assertions then fail for the wrong reason.
- **jest-dom matchers need two registrations:** `vitest-setup-client.ts` (runtime — the matcher
  implementations) and `src/vitest.d.ts` (types). Without the `.d.ts`, `svelte-check` reports missing
  matcher types on `expect(...)`; without the setup file, the matchers are not installed at all.
- **The Vite/Vitest majors are coupled** — `vite@7` + `vitest@3` + `@sveltejs/vite-plugin-svelte@6`.
  Upgrading one alone installs a second, nested copy of Vite, and `npm run check` starts failing on
  `vite.config.ts` with incompatible `Plugin` types.
- **e2e files must be named `*.e2e.ts`** to be picked up by Playwright, and they run against the
  preview server on port 4173, which Playwright starts for you.
- **There is no coverage script and no coverage gate.** Do not invent one.

## Rules

- Fix failures before finishing; never leave the tree red.
- Report what you actually ran. If you could not run a gate (for example, no database available),
  say so explicitly rather than implying it passed.
- If the change altered the schema, confirm migrations were generated and are part of the change
  (see `database-workflow`).

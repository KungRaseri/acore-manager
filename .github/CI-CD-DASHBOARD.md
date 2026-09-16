# CI/CD Dashboard

The primary CI/CD dashboard is the **live per-run summary** rendered on every GitHub Actions run —
the job's **step summary**, produced by the _📊 Summarize results_ step in
[`workflows/node.yml`](workflows/node.yml). It lists each gate and its result, and **fails the run
when any gate failed**.

This document is the static companion describing the pipeline and how to read a run. It deliberately
records **no quality metrics** — test counts, coverage numbers and phase status are not tracked here,
because numbers written by hand go stale and get trusted anyway. Read the live summary and the
artifacts instead.

## 🔄 Pipeline

**Triggers:** push to `main`, pull requests to `main`.
**Location:** [`.github/workflows/node.yml`](workflows/node.yml).
**Runner:** `ubuntu-latest` with a `mysql:8.4` service (database `acore_manager_test`, root password
`password`) and job-level `env` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `ORIGIN`).

Steps:

1. 🛒 Checkout → 🔧 Setup Node (22, npm cache) → 📦 `npm ci` → 🗂️ `mkdir -p ci-results`
2. 🏗️ **Build** (`npm run build`) → 🏗️ **Check** (`npm run check`, the type gate) → 🔎 **Lint** (`npm run lint`)
3. 🌐 **Install Playwright browsers** (`chromium --with-deps`) — required by the **e2e** suite only; the
   Vitest projects run in jsdom / node and need no browser
4. 🗄️ **Database bootstrap + migrations** (`node migrate.mjs`) — creates the database if missing, then
   migrates; warns (without failing) while no migrations exist under `drizzle/`
5. 🧪 **Tests** (`npm run test:unit -- --run --reporter=json --outputFile=ci-results/vitest.json`)
6. 🧪 **e2e** (`npx playwright test --reporter=github,html`)
7. 📦 **Artifacts** (always): `build-output`, `playwright-report`, `ci-results`
8. 📊 **Summarize** — writes the step summary and fails the job if any gate failed

Every gate uses `continue-on-error` so all results are collected in one run, and the final step reads
`steps.<id>.outcome` (which reflects the true result even under `continue-on-error`) to decide the
run's outcome.

### Gates

| Gate               | Command                      | Notes                                                                        |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------- |
| Build              | `npm run build`              | Vite production build                                                        |
| Check              | `npm run check`              | `svelte-kit sync` + `svelte-check`. **This is the type gate.**               |
| Lint               | `npm run lint`               | `prettier --check .` then `eslint .`                                         |
| Database bootstrap | `node migrate.mjs`           | Same script the container entrypoint runs; no-op-safe                        |
| Tests              | `npm run test:unit -- --run` | Vitest on jsdom + node projects; `--run` required (the script is watch mode) |
| e2e                | `npx playwright test`        | Runs the preview server via `playwright.config.ts`                           |

There is **no coverage gate** in this project — the `coverage` script does not exist and no coverage
is uploaded.

## 📦 Artifacts

| Artifact            | Contents                                          |
| ------------------- | ------------------------------------------------- |
| `build-output`      | `.svelte-kit/output`, `build`                     |
| `playwright-report` | `playwright-report`, `test-results`               |
| `ci-results`        | Per-gate logs (`*.log`) and Vitest's JSON results |

Artifacts upload with `if: always()`, so a failed run still gives you the logs.

## 🛠️ Troubleshooting

- **Playwright browsers missing** (`Executable doesn't exist…`): only the **e2e** suite needs them —
  unit tests run in jsdom and node. Locally run `npx playwright install chromium` (or `npm run test:e2e`,
  which installs them); CI installs `--with-deps chromium`.
- **CI hangs on the test step**: `npm run test:unit` is Vitest's **watch mode**. Always pass `-- --run`
  outside of interactive local use.
- **`npm ci` fails on the lockfile**: `.npmrc` sets `engine-strict=true` and some transitive
  dependencies require Node `^20.19.0 || ^22.13.0 || >=24`. Use a supported Node release.
- **Database step fails**: `node migrate.mjs` needs `DATABASE_URL`. It creates the database itself, but
  warns when there are no migrations yet. The MySQL service is provided for when they exist; the step is
  non-blocking meanwhile.
- **Per-run details**: Actions tab → the run → **Summary** (step summary) and **Artifacts**.

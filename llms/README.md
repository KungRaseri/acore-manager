# llms/ — Third-Party LLM Reference Files

This folder holds official `llms.txt` files (the [llmstxt.org](https://llmstxt.org) standard) downloaded from **other projects' documentation**. They are the **reference corpus** that the skills in [`../.roo/skills`](../.roo/skills) are built from.

We do **not** create an `llms.txt` for this project itself — this folder is only for external reference material.

## Structure

One subdirectory per project, keeping the upstream file names so provenance stays clear:

```
llms/
  betterauth/
    llms.txt             # Better Auth docs
  sveltekit/
    llms-full.txt        # combined Svelte 5 + SvelteKit docs
  ...
  README.md
```

## Currently present

| Folder         | Source                                                       | Used for                                                                                                                                           |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `betterauth/`  | better-auth.com                                              | Better Auth → [`.roo/skills/auth-setup`](../.roo/skills/auth-setup/SKILL.md)                                                                       |
| `bitsui/`      | bits-ui.com                                                  | Bits UI headless Svelte components → [`.roo/skills/ui-development`](../.roo/skills/ui-development/SKILL.md)                                        |
| `drizzle/`     | orm.drizzle.team                                             | Drizzle ORM + drizzle-kit → [`.roo/skills/database-workflow`](../.roo/skills/database-workflow/SKILL.md)                                           |
| `lucide/`      | lucide.dev                                                   | Lucide icons (index only) → [`.roo/skills/ui-development`](../.roo/skills/ui-development/SKILL.md)                                                 |
| `skeletondev/` | skeleton.dev                                                 | Skeleton v5 design system (themes, tokens, pairings, presets, components) → [`.roo/skills/ui-development`](../.roo/skills/ui-development/SKILL.md) |
| `sveltekit/`   | svelte.dev + kit.svelte.dev                                  | Svelte 5 runes + SvelteKit conventions → [`.roo/skills/sveltekit-development`](../.roo/skills/sveltekit-development/SKILL.md)                      |
| `tailwindcss/` | hand-built (Tailwind's authors do not publish an `llms.txt`) | Tailwind v4, CSS-first `@theme`/`@utility`/`@variant` → `sveltekit-development` + `ui-development`                                                 |
| `vite/`        | vite.dev                                                     | Vite dev/build/HMR → [`.roo/skills/verification`](../.roo/skills/verification/SKILL.md)                                                            |
| `vitest/`      | vitest.dev                                                   | Vitest (unit testing, mocking, config) → [`.roo/skills/verification`](../.roo/skills/verification/SKILL.md)                                        |
| `zod/`         | zod.dev                                                      | Zod v4 reference. **Not used in the codebase yet** (transitive dependency only)                                                                    |

## Verified against the installed packages

Corpus files are snapshots and can lag the installed versions. Where they disagree, **the installed
package and this section win**. Verified for the current `node_modules`:

- **Skeleton v5.0.1** — `@skeletonlabs/skeleton` exports `.` (resolving to the package's `index.css`,
  the CSS core) plus `./themes/*` (resolving to `src/themes/*.css`); **24 themes ship**, including
  `pine`. `@skeletonlabs/skeleton-svelte` exports `.` with **two** conditions: `import` (the components,
  used from JS/TS) and `style` (pointing at `dist/index.css`, which re-exports the components' CSS from
  `@skeletonlabs/skeleton-common`). **Both imports belong in the global stylesheet** — without the
  component one, every Skeleton component renders structurally but unstyled. The Svelte components are
  Zag.js wrappers styled through `data-scope`/`data-part` selectors. This project registers a custom
  theme (`src/themes/azeroth.css`) rather than a preset.
- **Bits UI v2.19.2** — headless primitives; named exports from `bits-ui`.
- **Vitest 3.2.7 + Vite 7.3.6 + `@sveltejs/vite-plugin-svelte` 6.2.4** — these majors are **coupled**.
  `@sveltejs/kit` 2.x still allows Vite 5–8 and `@tailwindcss/vite` 4.x allows 5–8, but
  `@sveltejs/vite-plugin-svelte` 7 requires Vite 8. A mismatched pair installs a second, nested copy of
  Vite under `node_modules/vitest/`, and `svelte-check` then fails on `vite.config.ts` with incompatible
  `Plugin` types.
- **Unit tests run in jsdom, not Vitest's `Browser Mode`** — `jsdom` + `@testing-library/svelte` 5
  (props are the **second** argument to `render`) + `@testing-library/jest-dom`. Playwright is e2e only.
- **Lucide v1.46.0** — exports `.`, `./icons` and `./icons/*`, so icons are imported individually
  (`@lucide/svelte/icons/<kebab-case-name>`). Corpus text citing "1760 icons in v1.29.0" is stale;
  the authoritative inventory is the installed package.
- **simple-icons v16.31.0** — brand marks only. **No `llms.txt` corpus exists for it** (the project
  does not publish one); consult the installed package.

## Where files come from

Many projects publish `llms.txt` at their docs root, and often `llms-full.txt` with the full content
inlined. Known publishers:

- Svelte: `https://svelte.dev/llms.txt` · SvelteKit: `https://kit.svelte.dev/llms.txt`
- Better Auth: `https://www.better-auth.com/llms.txt`
- Drizzle: `https://orm.drizzle.team/llms.txt`
- Zod: `https://zod.dev/llms.txt`
- Bits UI: `https://bits-ui.com/docs/llms.txt`
- Skeleton: `https://skeleton.dev/llms.txt`
- Lucide: `https://lucide.dev/llms.txt` (index only; the authoritative icon inventory is the installed `@lucide/svelte` package)
- Others: check the project's docs site for `/llms.txt`. Some (e.g. Tailwind) deliberately publish
  none — handle those with a hand-built reference, as `tailwindcss/` does.

## Candidates worth adding

Check each docs site for `/llms.txt`, and keep entries here only while they are relevant:

| Project        | Why it matters here                   |
| -------------- | ------------------------------------- |
| TypeScript     | strict TS + ESM across the app        |
| Playwright     | e2e tests (`playwright.config.ts`)    |
| Node.js        | runtime for the toolchain and configs |
| ESLint         | flat config                           |
| MySQL / mysql2 | the database driver used by Drizzle   |

## Usage

1. Create a subdirectory per project and drop the downloaded file(s) in.
2. Skills reference these files by path in their **References** section.
3. After adding a file, open the relevant skill(s) and tune the steps to match the actual content.
4. Record it in the tables above, and refresh the **Verified against the installed packages** section
   whenever the dependencies move — including the verification date.

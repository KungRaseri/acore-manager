---
name: ui-development
description: Use when building or changing the website UI — Skeleton design system, Bits UI headless components, Lucide/Simple Icons, design tokens, theming, or components under src/lib/components.
---

# UI Development

## When to use

- Building or restyling pages (landing, sign-in, admin screens, dashboards).
- Adding components from Skeleton, Bits UI, Lucide, or Simple Icons.
- Working with design tokens, theming, dark mode, or Tailwind classes.
- Placing or organising components under `src/lib/components/`.

## When NOT to use

- Route/load/action logic, server-only code, or build config — use `sveltekit-development`.
- Schema or auth wiring that happens to surface in the UI — use `database-workflow` / `auth-setup`.

## References

- [`llms/skeletondev/llms-full.txt`](../../../llms/skeletondev/llms-full.txt) — Skeleton v5: themes, tokens, color pairings, presets, typography, Svelte components, Tailwind utilities.
- [`llms/bitsui/llms-full.txt`](../../../llms/bitsui/llms-full.txt) — the complete Bits UI docs (components, type helpers, utilities).
- [`llms/lucide/llms.txt`](../../../llms/lucide/llms.txt) — Lucide docs index only; the authoritative icon inventory is the installed `@lucide/svelte` package.
- [`llms/tailwindcss/llms.txt`](../../../llms/tailwindcss/llms.txt) — Tailwind v4: CSS-first `@theme`, `@utility`, `@variant`.
- [`AGENTS.md`](../../../AGENTS.md) → UI & design system, Conventions.
- [`src/routes/layout.css`](../../../src/routes/layout.css) — the Tailwind/Skeleton entry point: core, component styles, theme, `dark` variant.
- [`src/themes/azeroth.css`](../../../src/themes/azeroth.css) — this project's theme; the reference for token shape.
- [`src/app.html`](../../../src/app.html) — the `<html>` element: `data-theme`, and the pre-paint mode script.
- [`src/lib/components/site/`](../../../src/lib/components/site) — the existing chrome (shell, nav, user menu, mode toggle).

## Current state — read this first

The design system **is** wired, and the project theme is `azeroth`.

- `src/routes/layout.css` imports, in order: `tailwindcss`, the Skeleton core, the Skeleton component
  styles, then `../themes/azeroth.css`.
- `data-theme="azeroth"` is set on `<html>` in `src/app.html`.
- No built-in preset theme is in use. Do not reach for `pine` or any other preset.

## Key facts (verified against the installed packages)

- **Skeleton CSS entry:** `@skeletonlabs/skeleton` — its `.` export resolves to the package's
  `index.css` (tokens, Tailwind utilities, presets), so `@import '@skeletonlabs/skeleton';` works.
- **Component styles are a separate import, and it is mandatory.** The Svelte components are styled by
  `@skeletonlabs/skeleton-common`, which `@skeletonlabs/skeleton-svelte` re-exports from its `style`
  export (`dist/index.css`). Import it from CSS — `@import '@skeletonlabs/skeleton-svelte';` — _as well
  as_ importing components from JS. Without it, components render structurally but unstyled. (The
  `llms/` corpus claims this import is wrong; the installed package contradicts it.)
- **Preset themes:** `@skeletonlabs/skeleton/themes/<name>` resolves to `src/themes/*.css`. **24 ship**,
  but this project registers only its own. Register only what you use — each theme grows the CSS bundle.
- **Theme activation:** `data-theme="<name>"` on `<html>` in `src/app.html`. Theme files are scoped
  `[data-theme='…']` blocks, which have the _same_ specificity as the core's generated `:root` defaults,
  so the theme import must come **after** the core import.
- **The project theme is a plain token file:** [`src/themes/azeroth.css`](../../../src/themes/azeroth.css)
  overrides `--color-{primary,secondary,tertiary,success,warning,error,surface}-{50..950}` plus the
  `contrast-*` ramps, `--typo-*`, `--radius-*`, `--color-root-bg-*` and `--color-brand-*`. Copy that file's
  structure when adding tokens; every token the core defines should keep an override.
- **Color tokens:** `{property}-{color}-{shade}` with shades 50–950, plus contrast variants.
- **Light/dark pairings:** `{property}-{color}-{lightShade}-{darkShade}` (e.g. `bg-surface-50-950`,
  `text-primary-300-700`). Shade 500 has no pairing.
- **Presets:** `preset-filled`, `preset-tonal`, `preset-outlined` (with per-color variants such as
  `preset-tonal-primary`, `preset-filled-success-500`). **Element sizes:** `size-elem-*`, `btn-lg`,
  `field-*`; icons inside Skeleton `btn`/`badge`/`chip` size automatically.
- **Dark mode is class-based here.** `layout.css` redefines Tailwind's `dark` variant as
  `&:where(.dark, .dark *)`; `.dark` on `<html>` also drives Skeleton's `color-scheme`, and therefore every
  `light-dark()` pairing. The class is set before first paint by the script in `src/app.html`, and
  `ModeToggle.svelte` flips it. All three share the `acore-mode` storage key — keep them in sync.
- **Skeleton's Svelte components are Zag.js wrappers**, styled through `data-scope`/`data-part` CSS from
  `@skeletonlabs/skeleton-common`. Component APIs in the docs are React-flavoured:
  - props are `class`, not `className`;
  - some behaviour lives on the root, not the part — `Menu` reports selection via `MenuProps.onSelect`
    (`details.value`), while `Menu.Item` only accepts `value`/`disabled`/`closeOnSelect`;
  - `Navigation` has **no** active-item prop: compare `page.url.pathname` yourself (see
    [`src/lib/navigation.ts`](../../../src/lib/navigation.ts)) and add `aria-current="page"` plus a preset.
  - `AppBar.Toolbar` is `display: grid` with **no default column template** — declare it, e.g.
    `class="grid-cols-[auto_1fr_auto]"`.
- **Bits UI** is headless (unstyled, WAI-ARIA compliant, composed from granular parts) and is used only
  where Skeleton has no counterpart: the mobile nav drawer (`Dialog`) in
  [`AppShell.svelte`](../../../src/lib/components/site/AppShell.svelte) and the `Separator` in
  [`UserMenu.svelte`](../../../src/lib/components/site/UserMenu.svelte).
- **Bits UI gotcha (v2):** `onValueChange` receives the **raw value**, not an event — do not read
  `event.currentTarget`. Controlled state is a `$bindable` `value` prop plus `onValueChange`.
  `Slider` distinguishes `onValueChange` (while dragging) from `onValueCommit` (on release).
- **Lucide:** exports `.`, `./icons` and `./icons/*`, so import icons individually —
  `import X from '@lucide/svelte/icons/<kebab-case-name>'` — rather than as a barrel.
- **Simple Icons** is for brand marks only (e.g. the Discord mark on the sign-in page, rendered as an
  inline `<svg><path d={siDiscord.path} /></svg>`).

## Steps

1. Decide whether the element is chrome/layout (Skeleton), a complex interactive primitive (Bits UI),
   or an icon (Lucide/Simple Icons).
2. Check whether a token or preset already expresses it — start from
   [`src/themes/azeroth.css`](../../../src/themes/azeroth.css) and `preset-*` before writing classes.
3. Read the relevant section of `llms/skeletondev/llms-full.txt` or `llms/bitsui/llms-full.txt`
   **before writing markup** — do not guess component APIs.
4. Build with Skeleton tokens, presets and Tailwind utilities only.
5. Place components by area: `src/lib/components/site/*` for site chrome, `src/lib/components/ui/*`
   for shared atoms. Add a feature-area folder when the management domain is defined.
6. Verify once at the end of the session (see `verification`).

## Rules

- **No hardcoded colors.** Use Skeleton tokens and presets.
- **No `<style>` blocks and no inline `style=` attributes** unless there is genuinely no alternative.
- **Never write a `{/* … */}` comment across multiple lines in markup.** Svelte's parser rejects the
  multi-line form and the failure cascades into unrelated errors; use `<!-- … -->` instead. (Multi-line
  comments inside `<script>` are fine.)
- **Wrap internal links in `resolve()`** from `$app/paths` — for `<a href>` and `goto()`. ESLint's
  `svelte/no-navigation-without-resolve` fails the build otherwise. Navigation data is resolved once, at
  definition, in `src/lib/navigation.ts`.
- Keep focus and outline styles intact — accessibility is not optional.
- Prefer Skeleton components over hand-rolled markup, and check the Skeleton inventory before reaching
  for Bits UI.
- Components must not mutate server state directly; they read what a load provided and submit actions
  or requests instead.
- Client components must never import `$lib/server/**`. If a component needs an authorization fact,
  compute it in `+layout.server.ts` and pass it as data (see `showAdminNav`).
- Do not copy UI conventions from the project this scaffold was copied from — verify a component,
  token or theme exists in **this** project first.

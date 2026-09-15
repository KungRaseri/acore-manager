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
- [`src/routes/layout.css`](../../../src/routes/layout.css) — the Tailwind entry point (Skeleton wiring goes here).
- [`src/app.html`](../../../src/app.html) — the `<html>` element, where the theme attribute belongs.

## Current state — read this first

**Both the packages and the stylesheet wiring are incomplete. Do not assume the design system is live.**

- Skeleton v5, Bits UI, Lucide and Simple Icons **are installed**.
- The global stylesheet has **not** been wired for Skeleton, and **no theme has been chosen**.
  `pine` is a placeholder inherited from another project; replace it rather than building on it.
- Until that is done, Skeleton classes and tokens will not resolve.

## Key facts (verified against the installed packages)

- **Skeleton CSS entry:** `@skeletonlabs/skeleton` — its `.` export resolves to the package's
  `index.css`, so `@import '@skeletonlabs/skeleton';` is a valid stylesheet import.
- **Themes:** `@skeletonlabs/skeleton/themes/<name>` resolves to `src/themes/*.css`. **24 themes ship**,
  including `pine`. Register only the themes you use — each one adds to the CSS bundle.
- **`@skeletonlabs/skeleton-svelte` is a Svelte component library, not a stylesheet.** It exports only
  `.` and is imported from TypeScript/Svelte, e.g. `import { AppBar } from '@skeletonlabs/skeleton-svelte'`.
  Importing it from CSS is wrong.
- **Theme activation:** a `data-theme="<name>"` attribute on the `<html>` element in `src/app.html`.
- **Color tokens:** `{property}-{color}-{shade}` with colors `primary`, `secondary`, `tertiary`,
  `success`, `warning`, `error`, `surface` (shades 50–950), plus contrast variants.
- **Light/dark pairings:** `{property}-{color}-{lightShade}-{darkShade}` (e.g. `bg-surface-50-950`,
  `text-primary-300-700`) so both modes work without extra classes. Shade 500 has no pairing.
- **Presets:** `preset-filled`, `preset-tonal`, `preset-outlined` (with per-color variants) for buttons,
  badges and cards. **Element sizes:** `size-elem-{xs..9xl}`, `w-elem-*`, `p-elem-*`; icons inside
  Skeleton `btn`/`badge`/`chip` size automatically.
- **Skeleton Svelte components** include `AppBar`, `Navigation`, `Avatar`, `Progress`, `Tabs`,
  `Dialog`, `Slider`, `Tooltip`, `Popover`, `Accordion`, `Combobox`, `Listbox`, `Menu`, `Pagination`,
  `Steps`, `Switch`, `Toast`, `TreeView`, `DatePicker`, `FileUpload`, `TagsInput`, `Portal` and more.
  **Prefer a styled Skeleton component for chrome and layout**; reach for Bits UI only where Skeleton
  has no equivalent.
- **Bits UI is headless** — unstyled, WAI-ARIA compliant, composed from granular parts
  (`Tabs.Root` → `Tabs.List` → `Tabs.Trigger` → `Tabs.Content`). Provide your own classes.
- **Bits UI gotcha (v2):** `onValueChange` receives the **raw value**, not an event — do not read
  `event.currentTarget`. Controlled state is a `$bindable` `value` prop plus `onValueChange`.
  `Slider` distinguishes `onValueChange` (while dragging) from `onValueCommit` (on release).
- **Lucide:** exports `.`, `./icons` and `./icons/*`, so import icons individually —
  `import X from '@lucide/svelte/icons/<kebab-case-name>'` — rather than as a barrel.
- **Simple Icons** is for brand marks only.

## Steps

1. Decide whether the element is chrome/layout (Skeleton), a complex interactive primitive (Bits UI),
   or an icon (Lucide/Simple Icons).
2. Read the relevant section of `llms/skeletondev/llms-full.txt` or `llms/bitsui/llms-full.txt`
   **before writing markup** — do not guess component APIs.
3. Build with Skeleton tokens, presets and Tailwind utilities only.
4. Place components by area: `src/lib/components/site/*` for site chrome, `src/lib/components/ui/*`
   for shared atoms. Add a feature-area folder when the management domain is defined.
5. Verify once at the end of the session (see `verification`).

## Rules

- **No hardcoded colors.** Use Skeleton tokens and presets.
- **No `<style>` blocks and no inline `style=` attributes** unless there is genuinely no alternative.
- **Lucide for general icons; Simple Icons only for brand marks. No emoji as UI icons.**
- Keep focus and outline styles intact — accessibility is not optional.
- Prefer Skeleton components over hand-rolled markup, and check the Skeleton inventory before reaching
  for Bits UI.
- Components must not mutate server state directly; they read what a load provided and submit actions
  or requests instead.
- Do not copy UI conventions from the project this scaffold was copied from — verify a component,
  token or theme exists in **this** project first.

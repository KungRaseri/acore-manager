---
name: new-feature
description: Use for an end-to-end feature that spans several areas — from orientation and design through schema, server logic, UI, and final verification.
---

# New Feature

## When to use

- A feature touches more than one area: routes, server-only logic, the database schema, and UI.
- You want a structured end-to-end workflow instead of jumping straight into code.

## When NOT to use

- A change confined to one area — go directly to the matching skill (`sveltekit-development`,
  `ui-development`, `database-workflow`, `auth-setup`) rather than this orchestration flow.

## References

- [`repo-context`](../repo-context/SKILL.md) — orientation.
- [`database-workflow`](../database-workflow/SKILL.md) — if the schema changes.
- [`auth-setup`](../auth-setup/SKILL.md) — if authentication or sessions are involved.
- [`sveltekit-development`](../sveltekit-development/SKILL.md) — routes, loads, actions, components.
- [`ui-development`](../ui-development/SKILL.md) — design system, components, styling.
- [`verification`](../verification/SKILL.md) — always, at the end.
- [`AGENTS.md`](../../../AGENTS.md) — the authoritative reference throughout.

## Steps

1. **Orient** — read [`repo-context`](../repo-context/SKILL.md), then [`AGENTS.md`](../../../AGENTS.md) in full.
2. **Design before coding.** Decide where each piece belongs:
   - route or page → `src/routes/`
   - server-only logic → `src/lib/server/`
   - table or column → `src/lib/server/db/schema.ts`
   - reusable component → `src/lib/components/`
     Record the decision if it changes the architecture, and update `AGENTS.md` accordingly.
3. **Check the boundary rules first.** Is anything about to read a secret, touch the database, or
   import server-only code into client code? Those are the mistakes that only surface at build time.
4. **Schema** (if needed) — follow [`database-workflow`](../database-workflow/SKILL.md): edit the
   schema, generate, then apply the migration.
5. **Server logic** — implement loads/actions in `+page.server.ts` / `+server.ts`, keeping database and
   auth clients lazily constructed.
6. **UI** — build the pages and components following [`sveltekit-development`](../sveltekit-development/SKILL.md)
   and [`ui-development`](../ui-development/SKILL.md).
7. **Verify once, at the end** — run [`verification`](../verification/SKILL.md): `npm run check`,
   `npm run lint`, the tests, and `npm run build`.
8. **Docs** — update `AGENTS.md` and any affected skill if the layout or conventions changed.

## Rules

- Keep the dependency direction clean: components never reach into `src/lib/server/**`; server code
  owns the database and auth.
- Keep database and auth clients lazy so the build stays DB-free.
- The scaffold placeholders (`src/routes/demo/**`, `src/lib/vitest-examples/**`) are gone; delete
  leftovers rather than building alongside them.
- **Build on what exists before inventing a scheme.** There _is_ a permission model — the tiers in
  `src/lib/access.ts`, enforced by `$lib/server/authz.ts` and the folder floors under `/staff` — and
  there is an AzerothCore integration layer. Reuse them instead of adding a second way to decide access,
  and remember that a form action checks for itself.
- Do not copy conventions from the project this scaffold was copied from — check that a pattern is
  actually present here before following it.

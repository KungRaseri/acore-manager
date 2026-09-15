# .roo/skills/ — Reusable Agent Skills

Reusable, tool-agnostic **Agent Skills** for AI agents working in this repository. Each skill is a folder containing a spec-compliant `SKILL.md` (`name`/`description` YAML frontmatter, where the `name` matches the folder) plus **when to use / when NOT to use**, **references**, **steps**, and **rules**.

Skills are built from two sources:

1. **Our instruction files** — [`AGENTS.md`](../../AGENTS.md), [`README.md`](../../README.md), and the source code.
2. **Third-party reference files** in [`../llms`](../../llms) — official `llms.txt` files from SvelteKit, Drizzle, Better Auth, Tailwind, Vite, Vitest, Zod, Skeleton, Bits UI and Lucide. Skills reference them by path; from a skill at `.roo/skills/<name>/SKILL.md` the repo-root `llms/` corpus is `../../../llms/...`.

## Catalog

| Skill                                                     | When to use                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`repo-context`](repo-context/SKILL.md)                   | Starting any work — orientation: layout, commands, conventions                   |
| [`database-workflow`](database-workflow/SKILL.md)         | Changing the Drizzle schema, migrations, or DB/env issues                        |
| [`auth-setup`](auth-setup/SKILL.md)                       | Better Auth: sessions, protected routes, auth features, auth schema regeneration |
| [`sveltekit-development`](sveltekit-development/SKILL.md) | Building routes, pages, loads/actions, or components                             |
| [`ui-development`](ui-development/SKILL.md)               | UI work: Skeleton design system, Bits UI, Lucide/Simple Icons, design tokens     |
| [`verification`](verification/SKILL.md)                   | Before finishing any change — check/lint/test/build                              |
| [`new-feature`](new-feature/SKILL.md)                     | End-to-end feature workflow spanning several areas                               |

## Format

See [`_template/SKILL.md`](_template/SKILL.md). Every skill uses the same structure so an agent can self-select the right one from the `description`. `_template` is a copy-me template (leading underscore, so it is not discovered as an activatable skill): create a new skill by copying it into `.roo/skills/<skill-name>/` and filling in the placeholders.

## Notes

- **No AzerothCore integration skill exists yet, on purpose.** The integration layer is deferred; add
  a skill for it when that work starts, documenting the integration surfaces and their security rules
  before any code is written.
- Skills describe **this** project. If a skill references a path, a package or a concept that does not
  exist here, treat it as a bug and fix it — this repository was scaffolded from another project and
  inherited documentation that did not always match reality.

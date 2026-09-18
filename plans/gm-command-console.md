# Design — GM command console: catalogue, browser, audit trail, execution

**Status:** proposed, awaiting review
**Roadmap item:** 4 — "Characters, bans and live operations" ([`AGENTS.md`](../AGENTS.md))
**Governing rule:** every action that changes a live realm stays unbuilt until it has an audit trail. This
design supplies the audit trail and the actions together — they are not separable.

---

## 1. Goal and scope

Give staff a **browser for the realm's own GM commands** and, for the first time, a way to **run** them
from the website — with every attempt recorded before it can touch the realm.

- The catalogue is **read from the realm**, not from a list we keep (`§3`).
- The browser merges the realm's command data with the signed-in staff member's **own** GM level, so a
  moderator sees moderator commands and an administrator sees administrator commands, in one page
  (`§7`, `§8`).
- Execution re-validates the command and the level **in the action**, because a layout does not cover an
  action (`§6`).
- Every attempt — including one refused by the site — leaves an **audit row** (`§5`).

Out of scope: bans and mutes as first-class tools, a staff-facing view of another player's characters,
per-realm scoping, and any command that acts on a selected target (`§13`).

## 2. What was verified, and where

Everything below was read from the source on **2026-09-18**. Nothing in this note is asserted from
memory, because the repository explicitly warns that inherited documents describe versions this project
does not have.

| Claim                                                                                                     | Source actually fetched                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The world database ships a populated `command` table holding name, security and help text with syntax     | [`azerothcore-wotlk` `data/sql/base/db_world/command.sql`](https://raw.githubusercontent.com/azerothcore/azerothcore-wotlk/master/data/sql/base/db_world/command.sql) (748 lines)                                                                      |
| The core reads that table                                                                                 | `src/server/database/Database/Implementation/WorldDatabase.cpp:81` — `PrepareStatement(WORLD_SEL_COMMANDS, "SELECT name, security, help FROM command", CONNECTION_SYNCH)`                                                                              |
| …and adopts its `security` as the command's required level, overriding its own value                      | [`ChatCommand.cpp:118-124`](https://raw.githubusercontent.com/azerothcore/azerothcore-wotlk/master/src/server/game/Chat/ChatCommands/ChatCommand.cpp) — `Table \`command\` has permission {} for '{}' which does not match the core ({}). Overriding.` |
| …and uses its `help` text as the command's help                                                           | `ChatCommand.cpp:126-132` (and a warning when the text is legacy or missing)                                                                                                                                                                           |
| A **console** caller is admitted by an explicit console flag, not by a security level                     | `ChatCommand.cpp:513-517` — console + `AllowConsole == No` → refused; console + `AllowConsole == Yes` → visible                                                                                                                                        |
| For non-console callers the check is the level (or an RBAC permission, which is a different code path)    | `ChatCommand.cpp:519-523` — the comment reads `RBAC permissions start at 200, SEC_* levels are 0-4`                                                                                                                                                    |
| Modern registration is RBAC plus a console flag, not a `SEC_*` value                                      | `src/server/scripts/Commands/cs_account.cpp:92` — `{ "create", HandleAccountCreateCommand, rbac::RBAC_PERM_COMMAND_ACCOUNT_CREATE, Console::Yes }`                                                                                                     |
| The wiki page the request links is a generated-looking table of Command / Security / Syntax / Description | [`azerothcore/wiki docs/gm-commands.md`](https://raw.githubusercontent.com/azerothcore/wiki/master/docs/gm-commands.md) (721 lines, frontmatter `redirect_from: "/GM-Commands"`)                                                                       |

The stock table's shape, quoted verbatim from `command.sql`:

```sql
CREATE TABLE `command` (
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `security` tinyint unsigned NOT NULL DEFAULT '0',
  `help` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chat System';
```

and two of its rows, quoted verbatim (the `\r\n` are literal in the dump):

```
('account create',4,'Syntax: .account create $account $password $email\r\n\r\nCreate account and set password to it.\r\n$email is optional, can be left blank.'),
('kick',2,'Syntax: .kick [$charactername] [$reason]\r\n\r\nKick the given character name from the world with or without reason. If no character name is provided then the selected player (except for yourself) will be kicked. If no reason is provided, default is "No Reason".'),
('server shutdown',3,'Syntax: .server shutdown #delay [#exit_code]\r\nShut the server down after #delay. Use #exit_code or 0 as program exit code.\n#delay: use a timestring like "1h15m30s".'),
('account password',0,'Syntax: .account password $old_password $new_password $new_password [$email]\r\n\r\nChange your account password. You may need to check the actual security mode to see if email input is necessary.'),
```

Sizes, counted from the same file: **699 rows** — 22 at security 0, 69 at 1, 252 at 2, 341 at 3, 15 at 4.

The wiki says two things a generated table does not, and both matter here (quoted):

> Note: Some commands are working only by selecting a player or a creature. These commands can not be
> used in the world console.

> Some commands require higher security level. To grant this you need to use the `account set gmlevel`
> command through the console.

**The wiki drifts from the stock table.** `account set gmlevel` and `account set password` are 3 in the
dump and 4 in the wiki; `account set gmlevel`'s help text differs; the wiki lowercases placeholders
(`#itemid` for `#itemID`) and rewrites descriptions. A realm's table is therefore a _different artefact_
from the wiki page, and only one of them is on the realm.

## 3. Decision 1 — the catalogue's source of truth

**Chosen: the realm's own `acore_world.command` table, read through `getAcoreWorldDb()`, with a committed
module that carries policy and fixtures but never the security numbers.**

### 3.1 The database route carries syntax, which was the only real objection to it

The usual argument against a database-backed catalogue was that syntax cannot be recovered at runtime.
It can. Each row's `help` column holds the syntax on its first line, prefixed `Syntax:` — the `kick` and
`server shutdown` rows above are the unedited form. `security`, `name` and `help` are all present, which
is exactly the three columns the wiki table publishes, plus the realm-specific rows the wiki cannot know
about (script-added commands, a rebalanced level).

### 3.2 Why the realm wins over a committed list

1. **The core adopts the table's number.** `ChatCommand.cpp:118-124` assigns `_permission.RequiredLevel`
   from `security`, overriding its own compiled-in value and logging when they disagree. A gate built on
   the realm's number therefore matches what the realm's own server would demand of an in-game caller,
   and a realm that has retuned a command is respected instead of contradicted.
2. **The repository's own principle.** `AGENTS.md`, _Characters_: "Names come from the server, never from
   a list kept here." A committed table of 699 commands would be a hardcoded list of exactly the kind the
   project rejects — and it would go stale silently, which is the failure mode the item-icon work already
   had to design around.
3. **The wiki is not reproducible at runtime and already disagrees with the dump** (`§2`). Choosing it
   would mean picking one snapshot of someone else's snapshot as the authority for an access decision.
4. **Realm-specific commands exist.** A realm with extra scripts has commands the wiki has never heard of;
   reading the table gives them names, levels and help for free. A committed list would hide them.

Reading it is also the cheapest thing here: one `SELECT` per page render, on the same lazy pool as every
other AzerothCore read ([`acore.ts`](../src/lib/server/db/acore.ts:53)), with no caching — the
"nothing is cached" rule in [`authz.ts`](../src/lib/server/authz.ts:51) and
[`reference.ts`](../src/lib/server/characters/reference.ts:15) applies unchanged.

### 3.3 What the committed module is, and what it is not

The brief allows a committed module if the database cannot carry syntax. It can, so the module is not the
catalogue. [`src/lib/gm-commands.ts`](../src/lib/gm-commands.ts) is a **client-safe vocabulary plus policy
overlay**, and it holds:

- the risk vocabulary and the curated deny list, each entry with a **written reason** (`§4.3`);
- pure helpers: `parseHelp()` (split `Syntax:` from the description), `groupOf()` (the first token of the
  name is the category), `isRunnable()` (the ceiling and floor rule);
- the truncation limits shared by the audit writer and the pages.

It holds **no per-command security number**. That is the line: a security number is an access input, and
access inputs come from the realm or from `authz`, never from a file we maintain. The one place a
committed list does carry meaning is the deny list — and that is additive (it can only ever _remove_
commands from the runnable set), which is the safe direction for a hardcoded list to err.

Provenance for fixtures: the spec for `parseHelp()` quotes rows copied from `command.sql`, with the file
and date in the comment. That is a test fixture, not a runtime input.

### 3.4 The security number is a policy input, not a server-enforced fact

This is the one genuinely surprising finding, and the design would be wrong without it.

AzerothCore admits a **console** caller by `AllowConsole` alone (`ChatCommand.cpp:513-517`), and our
execution path is a console path — SOAP is the worldserver console. The compiled-in console flag is not
in the table, so nothing we can read tells us whether a given command is console-capable. Two
consequences:

1. **Our gate is the enforcement point, not a restatement of the server's.** The SOAP credential is an
   administrator (gmlevel 3) and the server will run what we send it. Nothing stops a moderator from
   running `.server shutdown` except the check in our action. Its correctness is therefore load-bearing,
   which is why the per-command check lives in `authz` (`§6.2`) and why the deny list is tested.
2. **A command that needs a selected target cannot work from here at all** — there is no player or
   creature context on a SOAP call, which is precisely the wiki's caveat quoted in `§2`. The design does
   not pretend otherwise: such a command runs, the console answers with an error, and the operator and
   the audit trail both see the console's own words. We do not try to detect console-capability by
   parsing `.help` output; that would couple the site to console text formatting.

The level from the table is still the right number to gate on: it is the realm's declaration for the
command, it is the number the core adopts for non-console callers, and it is the number the wiki
publishes. It is a _policy_ claim rather than an enforcement mechanism, and this section is why the note
does not claim the server will back us up.

### 3.5 Failure modes

| Situation                                                     | Result                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACORE_DATABASE_URL` unset, MySQL down, or the query fails    | The catalogue is **unavailable**: the page renders an empty state naming the cause, **nothing is runnable**, and the failure is logged on every occurrence (the [`authz.ts`](../src/lib/server/authz.ts:97) precedent, because it is a broken link rather than a realm property). |
| Table exists but is empty (`SELECT` returns no rows)          | Same empty state, logged **once per process** with the cause, matching [`warnIfNoIconsAtAll()`](../src/lib/server/characters/reference.ts:161). A realm whose table is empty is a property of that realm, not of a request.                                                       |
| A row exists for a command the realm's core does not register | The console answers with an error; shown and audited. The core logs the mirror-image case itself (`ChatCommand.cpp:109`, "contains data for non-existant command").                                                                                                               |
| A command exists in the core with **no row**                  | It is absent from the catalogue and therefore **not runnable**. The name must come from the catalogue — that whitelist is what makes the form safe, and it fails closed.                                                                                                          |
| A realm's numbers disagree with the wiki                      | The realm wins, by construction. That is the point of reading the table.                                                                                                                                                                                                          |

**No fallback to a committed list.** When the table cannot be read, the console does nothing rather than
falling back to numbers we wrote down. A second source of truth for an access decision is the thing the
repository forbids, and a stale fallback is more dangerous than an honest empty state — it would offer
commands at levels the realm may no longer honour.

**Populating the table is a realm task, and it is already done by default.** The data ships in
AzerothCore's own base SQL (`data/sql/base/db_world/command.sql`, quoted in `§2`), so a normal realm has
it; the empty state says so and names the file. This project **never writes into `acore_world`** — one
`SELECT` is the only access the feature needs.

### 3.6 Alternatives rejected

- **A committed catalogue transcribed from the wiki.** Rejected in `§3.2`: stale by construction, blind to
  realm-specific commands, and a hardcoded list of security numbers. It survives only as the test fixture
  and the "what does this syntax mean" link the UI offers.
- **Parsing `.help` output over SOAP to build the catalogue.** The console text is prose; the reply format
  is not a contract. It would also need one SOAP call per command, against a single-threaded endpoint
  ([`soap.ts:22`](../src/lib/server/acore/soap.ts:22)).
- **Merging the table with a committed overlay that can _raise_ a level.** Allow-listing is fine; making a
  committed file able to declare a command safe is not. The overlay may only restrict.

## 4. Decision 2 — the catalogue's data shape

### 4.1 Types

```ts
// src/lib/gm-commands.ts — client-safe: no $lib/server import, so the browser can render it.
export type CommandRisk = 'read-only' | 'mutating' | 'realm-affecting' | 'blocked';

/** One row of the realm's `command` table, plus what we derive from it. */
export interface CommandEntry {
	/** The row's `name` — the token sequence after the dot, e.g. `account set gmlevel`. */
	name: string;
	/** The row's `security`, exactly as the realm stores it (0–4 in the stock table). */
	security: number;
	/** `tierForLevel(security)`, or `null` when the realm declares a level above our ladder. */
	tier: AccessTier | null;
	/** The first line of `help`, with the `Syntax:` prefix removed. */
	syntax: string;
	/** The rest of `help`, newlines normalised for display. */
	description: string;
	/** The name's first token: the realm's own category, e.g. `account`, `server`, `ban`. */
	group: string;
	/** Whether the syntax declares arguments — a display hint, never a validation rule. */
	takesArguments: boolean;
	/** Whether the command can be run through this site at all, and why not when it cannot. */
	runnable: boolean;
	/** The overlay's classification. Unknown commands are `mutating`, never `read-only`. */
	risk: CommandRisk;
	/** A sentence for the browser: the deny reason, or why the entry is outside our ladder. */
	note: string | null;
}

/** What the action needs, and nothing the page should be trusted with. */
export interface CommandCatalogue {
	entries: CommandEntry[];
	/** `false` when the table could not be read at all — distinct from "read, and empty". */
	available: boolean;
}
```

`security` is deliberately kept alongside `tier`: the tier is for badges and floors, the raw number is
what the audit row records and what a "the realm says 3" explanation quotes.

### 4.2 What is derived, and what is only a hint

`parseHelp()` splits on the first line matching `Syntax:` and strips the literal `\r\n` escapes the dump
contains. Missing `help`, a `help` with no `Syntax:` prefix, and a `help` with only a syntax line are all
normal cases (the core logs them too, `ChatCommand.cpp:143`) and must not throw.

`takesArguments`, and the optional/required split used to lay out the form, come from the syntax text:
`[ ]` marks optional, `$ ` and `< >` and `#` mark required. **These are hints.** The realm is the only
authority on how many arguments a command wants, so the site uses them to label a field and to pre-flight
the obviously-empty case (`§6.3`) — never to refuse a command the realm would have accepted.

### 4.3 Commands excluded, or specially handled

Level 0 first: **excluded entirely**. Those 22 rows are player self-service commands, and through the
console credential they act on the **console account** rather than the caller — `account password`,
`account 2fa setup` and `account lock` are quoted in `§2` and would change the SOAP account's own
credentials. They are not staff tooling and they are unsafe by accident, so they are neither listed nor
runnable.

Level 4 (15 rows) is **listed, not runnable**: it is above the site's ladder
([`access.ts:25`](../src/lib/access.ts:25) names `SEC_CONSOLE`), the site's own ladder clamps to
`administrator`, and the site does not pretend to be a console account.

Within reach (1–3), the curated overlay blocks by default where the blast radius is beyond the site's
ability to undo. Each entry carries its reason, and a spec pins the ones named here so a refactor cannot
silently drop one:

| Command                                                                                                                 | Level (stock)       | Decision             | Reason                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account set gmlevel`                                                                                                   | 3                   | blocked              | Privilege escalation. It grants levels, so a level-3 staff member could widen their own access and the site's ladder would stop describing anything.     |
| `account set password`, `account set email`, `account delete`                                                           | 3 (dump) / 4 (wiki) | blocked              | Credential and identity takeover of another profile's account; deletion is irreversible and the site has no restore path.                                |
| `character changeaccount`                                                                                               | 3                   | blocked              | Hands a character to another account — an ownership change nothing here can undo.                                                                        |
| `server shutdown`, `server restart`, `server idlerestart`                                                               | 3 / 3 / 4           | blocked              | Takes the realm down, and this site has no way to bring it back up.                                                                                      |
| `server shutdown cancel`, `server restart cancel`                                                                       | 3                   | **allowed**, confirm | Deliberately the exception: these are the way back from a timer somebody else started, and blocking the antidote while blocking the poison helps nobody. |
| `rbac *` (if the realm registers any)                                                                                   | —                   | blocked              | Same escalation argument as `account set gmlevel`.                                                                                                       |
| `kick`, `ban *`, `unban *`, `mute`, `character rename`, `character customize`, `tele *`, `announce`, `send`, `reload *` | 1–3                 | allowed, confirm     | These change live state and are the point of the feature; each is bounded in time or reversible by the same tool.                                        |
| list/query commands (`server info`, `server motd`, `.account <name>`, …)                                                | 1–3                 | allowed, no confirm  | Read-only.                                                                                                                                               |

The rule that keeps this list honest: **an unknown command is `mutating`.** Defaulting to "safe" would
turn every future command in a realm's table into something a moderator can fire with one click.

### 4.4 The runnable rule

A command is runnable through this site exactly when all of these hold:

1. `security >= 1` — level 0 is player self-service (`§4.3`);
2. `security <= 3` — the ceiling of the site's own ladder and of its SOAP credential;
3. the overlay does not mark it `blocked`;
4. the acting profile's effective level is `>= security` (`§6.2`).

Rule 4 is checked in the action, per request; rules 1–3 are properties of the entry, computed once by the
reader. The browser shows a command the visitor cannot run as **disabled with the reason** rather than
hiding it — a staff member who forges the POST gets a 403 either way, and seeing "needs gmlevel 3" is the
whole point of browsing by level. That is a display choice, not a security one; the alternative (hide)
is a one-line change in the page's filter.

## 5. Decision 3 — the audit trail

### 5.1 The table

`command_audit`, declared in [`schema.ts`](../src/lib/server/db/schema.ts:23) beside `game_account`, and
**the name is free**: the project-owned tables today are `game_account` and the generated Better Auth set
`user` / `session` / `account` / `verification`
([`auth.schema.ts:11,24,43,67`](../src/lib/server/db/auth.schema.ts:11)).

| Column           | Type                          | Why                                                                                                                         |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `varchar(36)` PK              | `randomUUID()`, matching `game_account.id` ([`schema.ts:26`](../src/lib/server/db/schema.ts:26)).                           |
| `user_id`        | `varchar(36)` NOT NULL, index | The acting profile. **No foreign key, deliberately** — see the note below.                                                  |
| `actor_name`     | `varchar(255)` NOT NULL       | The display name at the time. Denormalised so the row stays readable after a rename or a deletion.                          |
| `actor_level`    | `tinyint unsigned` NOT NULL   | The effective gmlevel the check actually used — the number that decides whether the record is a breach or a routine action. |
| `command`        | `varchar(64)` NOT NULL, index | The catalogue name (`ban character`), never a line of text from the form.                                                   |
| `arguments`      | `varchar(1000)`               | The validated argument string, verbatim, or NULL.                                                                           |
| `target`         | `varchar(64)`                 | Best-effort first argument, for search. `arguments` is the authority; this is a convenience.                                |
| `status`         | `varchar(16)` NOT NULL        | `pending` / `success` / `failed` / `refused`. A varchar, not an enum: `SoapFailureReason` grows                             |
|                  |                               | ([`soap.ts:36-44`](../src/lib/server/acore/soap.ts:36)) and adding an enum value is a DDL change.                           |
| `failure_reason` | `varchar(32)`                 | Mirrors `SoapFailureReason`, plus `refused`. NULL on success.                                                               |
| `message`        | `varchar(512)`                | The human-readable failure, as the operator saw it.                                                                         |
| `output`         | `text`                        | The console's own reply, truncated to `MAX_AUDIT_OUTPUT` (2000 chars).                                                      |
| `duration_ms`    | `int unsigned`                | How long the SOAP call took — the only way to notice a queue building up behind the serialised client.                      |
| `created_at`     | `timestamp(3)` NOT NULL       | When the attempt was recorded.                                                                                              |
| `finished_at`    | `timestamp(3)`                | Set with the outcome; NULL while `pending`.                                                                                 |

**Why `user_id` has no foreign key.** A cascade would erase the history of a profile that was deleted —
the opposite of what an audit trail is for — and `game_account`'s cascade
([`schema.ts:29`](../src/lib/server/db/schema.ts:29)) exists to protect _data_, not to record _events_.
So the column is a plain indexed id, joined to `user` while the profile exists and readable as
`actor_name` after it does not. The cost is no referential integrity; the benefit is that the record is
not the profile's to delete.

### 5.2 Indexes and retention

- `command_audit_created_at_idx` — the trail is read newest-first.
- `command_audit_user_id_created_at_idx` — "what did this profile do", the composite that a
  two-single-column pair cannot serve as well in MySQL.
- `command_audit_command_idx` — "every time this command was used".

**Retention: keep everything, and build no pruning.** One row per execution is negligible at private-realm
staff volumes, the table is the product of the feature rather than a by-product, and this app has no
scheduler in which to run a retention job — `migrate.mjs` runs once at boot and nothing else is periodic.
An operator who wants to prune has the date index and SQL. Deliberately not built: a "delete my history"
path, and any UI that edits or removes a row. The trail is append-only, and the page that shows it has no
actions at all.

### 5.3 Writing the row: intent first, outcome second

`acore_manager` and AzerothCore's databases cannot share a transaction (`AGENTS.md`, _Database workflow_),
and here the gap is not between two databases but **across the SOAP call**, which can run for the client's
10-second timeout ([`soap.ts:34`](../src/lib/server/acore/soap.ts:34)). Holding one MySQL transaction open
across that call would pin a pool connection and hold locks for up to ten seconds to protect nothing, so
the write is two statements:

1. **Before** the command is sent: `INSERT` the intent — `status = 'pending'`, actor facts, command,
   arguments, the resolved level. **Nothing is sent to the worldserver until this insert succeeds.**
2. **After** it returns: `UPDATE` that row with `status`, `failure_reason`, `message`, `output`,
   `duration_ms` and `finished_at`.

Both statements live in one module, [`src/lib/server/commands/audit.ts`](../src/lib/server/commands/audit.ts),
so "what is recorded" is answered in one file. `executeCommand()` returns a discriminated result for every
outcome ([`soap.ts:46-48`](../src/lib/server/acore/soap.ts:46)) — it does not throw for a timeout, a
refusal or an unreachable host — so the second statement is on a single, uniform path with no `try/finally`
subtlety, and a failed execution is recorded exactly like a successful one.

Refusals are the third case: a command above the actor's level, or a blocked one, never gets a `pending`
row. It gets a single `INSERT` with `status = 'refused'` and `failure_reason = 'refused'`, written
**before** the 403 is thrown, because a moderator posting `.server shutdown` is precisely the event worth
having in the record.

### 5.4 When the audit write itself fails

- **The intent insert fails ⇒ the command is not run.** The action returns an error saying the audit trail
  is unavailable and that nothing was executed. This is the roadmap rule taken literally: no trail, no
  action. The failure is logged.
- **The outcome update fails ⇒ the command has already run.** There is no undo, so the code logs at error
  level with the whole outcome (command, arguments, result, output) — the log becomes the fallback record —
  and tells the operator plainly that it ran and its outcome could not be recorded. It does **not** silently
  succeed, and it does **not** retry in a loop inside the request.
- **A crash between the two** leaves a `pending` row. That is honest: something was attempted and no
  outcome was recorded, and the trail page renders it as such rather than hiding it. Writing the outcome
  first and the intent afterwards would be worse — a missing row leaves no evidence at all.

## 6. Decision 4 — the execution path

### 6.1 The order of operations in the action

The action is `run`, on `/staff/moderator/commands`, and it does these in this order:

1. `const access = await getAccess(locals)` and `requireStaff(access)`. **An action is not covered by a
   layout** ([`authz.ts:46-49`](../src/lib/server/authz.ts:46)): SvelteKit runs the action before the
   page's loads, so without this line any POST would spend the site's administrator credential whatever
   tier the sender had. [`gm/+page.server.ts:37-38`](<../src/routes/(staff)/staff/gm/+page.server.ts:37>) is
   the precedent, and it exists because the same hole was found once already
   ([`plans/gm-level-gating.md:37-43`](gm-level-gating.md)).
2. Read the submitted command **name** and look it up in the catalogue. Not found ⇒ 404. The name is a
   lookup key and never a fragment of a command line.
3. Policy: not runnable (level 0, above the ceiling, or blocked) ⇒ audit `refused`, then 403 with the
   entry's `note`.
4. `requireCommandLevel(access, entry.security)` — the level check, in `authz` (`§6.2`). Refused ⇒ audit
   `refused`, then 403.
5. Validate the arguments (`§6.3`) and the confirmation token (`§8`).
6. Insert the `pending` audit row. Failure ⇒ refuse, nothing is executed (`§5.4`).
7. `executeCommand(line)` — the serialised, timeout-bounded client
   ([`soap.ts:81`](../src/lib/server/acore/soap.ts:81)). The line is built from the **catalogue's** name
   plus the validated arguments.
8. `UPDATE` the row with the outcome.
9. Return one result object, shaped like the existing `CheckResult`
   ([`gm/+page.server.ts:10-14`](<../src/routes/(staff)/staff/gm/+page.server.ts:10>)) so the page renders
   success and failure the same way it already does.

### 6.2 Where the per-command check lives

A new helper in [`authz.ts`](../src/lib/server/authz.ts:161), beside the others and nowhere else:

```ts
/** Refuses an actor whose own level is below what the realm declares for this command. */
export function requireCommandLevel(access: Access, requiredLevel: number): void {
	if (access.level < requiredLevel) {
		error(403, `This command needs gmlevel ${requiredLevel} on a linked game account.`);
	}
}
```

Two things this deliberately is not:

- **Not a catalogue policy.** Whether a command is runnable _at all_ is a property of the entry, computed
  by the reader in `$lib/server/acore`; `authz` stays the thing that answers "may this user do this?" and
  learns nothing about 699 commands.
- **Not a floor on the folder.** The folder floor is the _softest_ audience of the tool (`§7`); the
  per-command level is checked per request in the action. The two answer different questions, and only
  the second one can say no to a specific command.

The signature is `(access, number)` rather than `(access, entry)` so `authz` keeps no dependency on the
catalogue's types, and so a spec can exercise it without a database.

### 6.3 Argument handling, and the precedent it follows

The order the action builds is `.` + the catalogue name + the validated arguments. The validation rule
comes from [`rules.ts:10-27`](../src/lib/server/accounts/rules.ts:10), which already documents the
reasoning: **the server splits a command on spaces**, so an argument containing one silently becomes two
arguments. Applied here:

- the argument string is trimmed; empty is legal (many commands take none);
- **any control character is refused** — `\r`, `\n` and `\t` included — because the value is interpolated
  into a console line and the console is line-oriented. `escapeXml` in
  [`soap-protocol.ts`](../src/lib/server/acore/soap-protocol.ts) makes the value safe _for XML_, not for the
  console's own parser, and we do not lean on the transport to sanitise a command;
- length is capped (`MAX_COMMAND_ARGUMENTS = 200`), the same "bound the hostile input" habit as
  `validateExistingPassword`'s 64-character limit ([`rules.ts:162-172`](../src/lib/server/accounts/rules.ts:162));
- if the syntax declares **no** arguments and the form supplies some, the request is refused rather than
  quietly ignoring the input;
- the name itself is never validated by hand: it came out of the catalogue, which is the whitelist.

Unlike a _new account password_ (whitespace-free by policy, `rules.ts:44`), an existing account's password
is deliberately unconstrained because it is hashed and never sent to a console. The commands here are the
opposite case — every one of them hits the console — so the strict rule applies to all of them.

### 6.4 The trust boundary is unchanged

Reading `acore_world.command` for an access decision sounds like trusting a table we do not own. It is
not a widening: the core already adopts that table's `security` for the command's own required level
(`ChatCommand.cpp:118-124`), and it adopts its help text. Anyone who can write to that table can already
change what the realm's commands require — and can already register a command, since the core looks up
`_invoker` in its own map. Our gate adds no new consumer of untrusted data; it reads the same rows the
server does, for the same purpose. That is worth stating in the code comment, because it is the question a
reviewer will ask.

## 7. Decision 5 — routes and floors

```
src/routes/(staff)/staff/moderator/commands/
	+layout.server.ts   requireStaff           >= 1   (declared, per the folder-name contract)
	+page.server.ts     load: catalogue + access; action: run
	+page.svelte        the browser and the runner
src/routes/(staff)/staff/admin/audit/
	+layout.server.ts   requireServerManager   >= 3
	+page.server.ts     load: one page of audit rows (?page=); no actions
	+page.svelte        the trail
```

| URL                         | Floor | What it is                                                                   |
| --------------------------- | ----- | ---------------------------------------------------------------------------- |
| `/staff/moderator/commands` | ≥ 1   | The console: browse the realm's commands, run the ones this visitor may run. |
| `/staff/admin/audit`        | ≥ 3   | The trail: every attempt, newest first. Read-only, no actions.               |

**Why the console sits at `/staff/moderator` and lists tier-3 commands anyway.** The folder name is a
floor for the _route_, and the contract says a tool lives in the folder matching its **softest**
audience ([`plans/gm-level-gating.md:176-180`](gm-level-gating.md)). The softest audience of a command
browser is a moderator: 69 stock commands are level 1, and `.kick`/`.ban` at level 2 are the tools the
request is about. Requiring gmlevel 3 to _reach_ the browser would hide the level-1 and level-2 commands
behind a tier that mostly does not need them. What a visitor may _execute_ is decided per command from the
realm's own security number, in the action — not by the folder. A tier-3 holder opening the same page sees
the level-3 rows enabled because their own level is 3; a moderator sees them disabled, with the reason.

The alternative placement was `/staff/admin/commands` (floor ≥ 3, `requireServerManager`), which is
self-consistent but answers the wrong request: it makes the console administrator-only and leaves the
72 level-1 and level-2 commands unreachable. `/staff/gm/commands` (≥ 2) is the middle option and still
excludes moderators. Deliberately **not** used: a fourth folder. `staff-routes.spec.ts:122-128` requires
every directory directly under `/staff` to be named `moderator`, `gm` or `admin`, so a new `/staff/commands`
would fail the build — correctly, because that test exists to keep the floors nameable.

**The trail is administrator-only** because it is a forensic record across all staff: it contains
arguments naming players, accounts and reasons. A moderator sees the outcome of their own action inline;
the page that aggregates everyone's actions is a tier-3 tool. It sits under `/staff/admin/` for that
reason, and its layout declares `requireServerManager` — equal to the floor its folder name implies.

### 7.1 Compliance with the route-floor spec

Walking [`staff-routes.spec.ts`](../src/lib/server/staff-routes.spec.ts) against this tree:

- Every directory directly under `/staff` stays `moderator` / `gm` / `admin` (`:122-128` — `commands` and
  `audit` are _nested_, not direct children).
- `moderator/commands` has a page, so it must have its own `+layout.server.ts` declaring **exactly one**
  helper (`:65-81`). It declares `requireStaff`, at the floor its parent implies.
- `admin/audit` likewise declares exactly `requireServerManager`.
- One trap worth writing down: `declaredFloors()` is a **substring search** over the layout's text
  (`:41-45`), comments included. A layout that mentions `requireServerManager` in a comment _and_ calls
  `requireStaff` declares two floors and fails the spec. Each new layout must name exactly one of the three
  helpers, anywhere in the file.
- The `inspected` assertion uses `arrayContaining` (`:116-118`), so two extra folders are tolerated.

## 8. Decision 6 — UI plan

### 8.1 Components

| File                                                                                                        | Role                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/lib/components/commands/CommandBrowser.svelte`](../src/lib/components/commands/CommandBrowser.svelte) | Filters (level, group, search) over the catalogue, and the grouped list.                                                                     |
| `src/lib/components/commands/CommandRow.svelte`                                                             | One command: name, tier badge, risk chip, syntax; expands to description and the runner.                                                     |
| `src/lib/components/commands/CommandRunner.svelte`                                                          | The form for one command: argument field, confirmation, submit, inline outcome.                                                              |
| `src/lib/components/commands/CommandOutput.svelte`                                                          | The console's reply — reuse the `<pre class="pre">` treatment from [`gm/+page.svelte:48`](<../src/routes/(staff)/staff/gm/+page.svelte:48>). |
| `src/lib/components/commands/AuditTable.svelte`                                                             | The trail page's table, with the truncation note.                                                                                            |

Both pages keep the existing shell convention — a `max-w-4xl` column with `card preset-filled-surface-100-900`
sections — as in [`gm/+page.svelte:10-21`](<../src/routes/(staff)/staff/gm/+page.svelte:10>).

### 8.2 Primitives, and why those

Available components were checked in [`llms/skeletondev/llms.txt:130-169`](../llms/skeletondev/llms.txt:130)
and [`llms/bitsui/llms.txt:28-67`](../llms/bitsui/llms.txt:28) before naming any of them.

- **Skeleton `Tabs`** for the level filter (`Mine` / `Everything I can run` / `All levels`) and for the
  trail's status filter. Cosmetic, client-side, over data already loaded.
- **Skeleton `Accordion`** for the catalogue list: one row per command, expanding to the description, the
  realm's full help text and — for a runnable command — the runner. It needs no dialog, no client state
  beyond the expansion, and it keeps the whole catalogue in the DOM for search.
- **Skeleton `Chips`** (or the existing `badge preset-*` classes) for the tier and the risk. Tier labels
  come from `TIER_LABELS` ([`access.ts:45`](../src/lib/access.ts:45)) so the site names a tier in one place.
- **Skeleton `Tables` + `Pagination`** on the trail, paged server-side with `?page=` and `LIMIT/OFFSET`
  rather than loading the whole history.
- **A plain search `<input class="input">` and a group `<select class="select">`**, rather than a
  `Combobox`. The catalogue is one page of data and a text filter over it is the whole requirement;
  a Combobox would add keyboard and portal behaviour nobody asked for.
- **Bits UI `Collapsible`** — or Skeleton's own `Collapsible` — to reveal the confirmation step inside
  the run form. Justification: it must live _inside_ the form so the typed confirmation posts with it, and
  it must work without JavaScript. **Bits UI `AlertDialog` is deliberately not used**: a modal is a worse
  fit for a destructive action than an inline step with a required typed value, because it is dismissible
  by reflex and it would put the confirmation text outside the form that submits it.
- **No `Toast`.** The outcome belongs next to the command that produced it, and the same outcome is
  already permanent in the trail.

### 8.3 How a command is presented and confirmed

- The row shows the **realm's own syntax** with its placeholders intact (`$account`, `#delay`, `[#exit_code]`),
  because normalising it would invent a format the server does not use.
- The tier required is shown as a badge plus the raw number ("gmlevel 3 — Administrator"), and a command
  above the visitor's level is shown **disabled with the reason**, not hidden (`§4.4`).
- A `read-only` command runs from a single button. A `mutating` or `realm-affecting` command requires the
  actor to **type the command name** into a confirmation field; the runner's submit stays disabled until it
  matches, **and the server validates the same field** — a client-side guard is not a guard, and a forged
  POST that omits it is refused and audited as `refused`.
- Immediately after a run the page shows the console's output verbatim (or the failure message) plus the
  audit row's id, so the operator can see that the action was recorded.
- The forms keep working without JavaScript; `use:enhance` is used only to show a pending state, because a
  console call can legitimately take seconds.
- The page carries the sentence that matters about scope: these commands run as the **site's** console
  account, so what a command does is bounded by what the realm lets _that_ account do — not by the
  visitor's own in-game standing.

## 9. Test plan

Specs run in the `server` Vitest project, which includes `src/**/*.{test,spec}.{js,ts}` and excludes only
`*.svelte.spec.ts` ([`vite.config.ts:48-56`](../vite.config.ts:48)); `expect.requireAssertions` is on
(`:34`), so every test asserts something.

1. **`src/lib/gm-commands.spec.ts`** — the pure half:
   - `parseHelp()` against rows copied from `command.sql` (provenance in the comment): `\r\n` handling,
     a `Syntax:` first line, a `help` with no `Syntax:` prefix, a NULL `help`, optional `[ ]` arguments and
     required `$`/`#` ones;
   - `groupOf('account set gmlevel') === 'account'`;
   - the runnable rule: level 0 not runnable, level 4 not runnable, levels 1–3 runnable;
   - the deny list contains the entries named in `§4.3`, each with a non-empty reason, and an unknown
     command defaults to `mutating`.
2. **`src/lib/server/acore/commands.spec.ts`** — the row → `CommandEntry` mapping as a pure function, so it
   needs no MySQL (the [`reference.ts`](../src/lib/server/characters/reference.ts:38) habit of keeping the
   query thin): a NULL `help`, a garbage/negative level, a level above 4 clamping to `tier: null`, and
   whitespace in `name`.
3. **`src/lib/server/authz.spec.ts`** — extended: `requireCommandLevel` throws 403 for a level below the
   command's and returns at or above it.
4. **`src/lib/server/staff-routes.spec.ts`** — **unchanged**, and it must still pass: the two new folders
   are inspected, each names exactly one helper, and neither is below its folder's floor (`§7.1`).
5. **`src/lib/server/commands/audit.spec.ts`** — the pure part: the row builders (`pending` intent,
   `refused` record, outcome update) produce the right column values, and `output`/`arguments` truncate at
   the shared limits.

Not covered by tests, and why: the `SELECT` against the realm, the SOAP call, the audit writes and the
action all need a live database and a live worldserver, and this repository has no test database
(`vite.config.ts` configures none). The manual walk is the gate:

- a level-1 session sees level-1 commands enabled and level-2/3 disabled;
- a level-1 session POSTing a level-3 command gets 403 **and** a `refused` audit row, with **no SOAP call**;
- a level-3 run writes `pending` → `success` with the console output;
- with the worldserver stopped, the same run writes `pending` → `failed` / `unreachable`;
- with `acore_world.command` emptied, the page explains itself and nothing is runnable.

Then the standard gate, once, at the end: `npm run check`, `npm run lint`, `npm run test:unit -- --run`,
`npm run build`. `npm run test:e2e` needs a live database and downloaded browsers and is not part of
routine verification.

## 10. Docs impact

**[`AGENTS.md`](../AGENTS.md):**

- _Repository layout_ — add `src/lib/gm-commands.ts`, `src/lib/server/acore/commands.ts`,
  `src/lib/server/commands/`, `src/lib/components/commands/`, the two route folders, and the new migration.
- _Route groups & authorization_ — the tier ladder table gains `/staff/moderator/commands` (≥ 1) and
  `/staff/admin/audit` (≥ 3), plus one sentence: the folder is the route's floor, the command's own
  security number is enforced in the action through `authz`.
- _AzerothCore integration_ — a **Command catalogue** subsection: the `command` table and
  `WORLD_SEL_COMMANDS`, the core adopting the table's `security` (`ChatCommand.cpp:118-124`), the
  `AllowConsole` caveat (`:513-517`), and the level-4 ceiling.
- New section — **GM command console & audit trail**: the two-phase write, why no transaction spans the
  SOAP call, refusals are recorded, no pruning, and that the trail is append-only.
- _Known issues_ — the site-side gate is the enforcement point (the SOAP credential is an administrator);
  the catalogue is only as good as the realm's table; console-capability is not in the table, which is why
  target-selecting commands cannot work from here; the site's ladder stops at `administrator`, so level-4
  commands are reference-only.
- _Environment & setup_ — the `.env.example` grants note gains `SELECT ON acore_world.command`.
- _Roadmap_ item 4 — the console, its audit trail and the browse/execute half are done; bans, mutes and
  anything else that changes a live realm follow the same audit-first pattern.

**[`.env.example`](../.env.example:20)** — the `acore_world` grant line gains `command`, with the reason
(reading the realm's own catalogue).

**Skills:**

- [`repo-context`](../.roo/skills/repo-context/SKILL.md:60) — "AzerothCore integration has started but is
  thin" is now wrong: the catalogue, the console and the trail exist.
- [`database-workflow`](../.roo/skills/database-workflow/SKILL.md:56) — two stale claims to fix in passing:
  `game_account` is no longer "the project's second table", and its migration **does** exist
  ([`0001_awesome_tombstone.sql`](../drizzle/0001_awesome_tombstone.sql:1)). Add `command_audit`, and say
  plainly that it has **no foreign key to `user` on purpose** so a later reader does not "fix" it.
- [`sveltekit-development`](../.roo/skills/sveltekit-development/SKILL.md:39) — the staff-floor paragraph
  gains the nested example, and the trap from `§7.1`: a layout must name exactly one `require*` helper,
  comments included.
- `new-feature` and `verification` — no change.

## 11. Work breakdown

Each item is one coding session. Items 1 and 2 are independent and can run in either order.

1. **Schema + migration.** `src/lib/server/db/schema.ts` (the `command_audit` table, three indexes, no FK),
   then `npm run db:generate` to produce `drizzle/0002_*.sql` + `drizzle/meta/*`. Files:
   [`schema.ts`](../src/lib/server/db/schema.ts), [`drizzle/`](../drizzle). Verify with `npm run check`.
2. **Catalogue vocabulary and policy overlay.** `src/lib/gm-commands.ts` (types, `parseHelp`, `groupOf`,
   `isRunnable`, the deny list with reasons, truncation limits) + `src/lib/gm-commands.spec.ts` with
   fixtures quoted from `command.sql`. Files: `src/lib/gm-commands.ts`, `src/lib/gm-commands.spec.ts`.
3. **Realm reader.** `src/lib/server/acore/commands.ts` — one query on `getAcoreWorldDb()`, mapped through
   a pure `toCommandEntry()`; `readCommandCatalogue()` returning `CommandCatalogue`, and `findCommand()`
   for the action; re-export from `src/lib/server/acore/index.ts`; `src/lib/server/acore/commands.spec.ts`.
4. **Audit writer and the access helper.** `src/lib/server/commands/audit.ts` (open / finish / refuse, plus
   the paged read for the trail page), `requireCommandLevel()` in
   [`authz.ts`](../src/lib/server/authz.ts:161), the `authz.spec.ts` extension, and the `.env.example`
   grant line. Files: `src/lib/server/commands/audit.ts`, `src/lib/server/commands/audit.spec.ts`,
   `src/lib/server/authz.ts`, `src/lib/server/authz.spec.ts`, `.env.example`.
5. **The console route.** `+layout.server.ts` (exactly one helper: `requireStaff`), `+page.server.ts`
   (load: catalogue filtered for display + `access`; the `run` action in the order of `§6.1`).
   Files: `src/routes/(staff)/staff/moderator/commands/+layout.server.ts`, `+page.server.ts`.
6. **The console UI.** `CommandBrowser`, `CommandRow`, `CommandRunner`, `CommandOutput`, then
   `+page.svelte`. Files: `src/lib/components/commands/*.svelte`,
   `src/routes/(staff)/staff/moderator/commands/+page.svelte`.
7. **The trail page, nav and copy.** `audit` route (layout + load + page), `AuditTable.svelte`, two
   nav items in [`navigation.ts`](../src/lib/navigation.ts:59) (`Console`, minTier `moderator`; `Audit
trail`, minTier `administrator`), and the copy that is now false:
   [`gm/+page.svelte:72-82`](<../src/routes/(staff)/staff/gm/+page.svelte:72>) ("the command box lives one
   tier up, at Administration") and the `/staff/admin` placeholder.
8. **Docs and verification.** `AGENTS.md` (§10), the three skills, then `npm run check`, `npm run lint`,
   `npm run test:unit -- --run`, `npm run build`.

## 12. Open decisions and risks

1. **A realm's table may not match the dump, and this project already depends on that being true.**
   Master's dump declares `account create` at level 4, yet account creation over SOAP with a level-3
   credential works here ([`AGENTS.md`](../AGENTS.md), _Game accounts_) — which `ChatCommand.cpp:513-517`
   explains, since a console caller is admitted by `AllowConsole`, not by a level. The design is written so
   the discrepancy cannot matter (the level is policy, the console's reply is the record), but the
   implementer should run one `SELECT` against the target realm's `command` table before deciding whether
   level-4 rows are shown as reference-only (the default here) or hidden outright.
2. **Whether a moderator should _see_ commands above their level.** This design shows them disabled with
   the reason. Hiding is equally defensible; it is one filter in the page's load, not a change to any
   check.
3. **Who may read the trail.** Administrator-only is the recommendation (`§7`). If moderators should see
   their own rows, that is a filter on `user_id` and needs no new floor — but it does need a decision about
   whether a moderator may see the _arguments_ of their own actions, which is the same question as `§5`.
4. **Console output is truncated** at 2000 characters, so a long listing loses its tail. The column and the
   page must both say so; the alternative is an unbounded column, which is worse.
5. **No bound on the SOAP queue.** Calls are serialised one at a time
   ([`soap.ts:59-67`](../src/lib/server/acore/soap.ts:59)) with no limit on how many may wait, so a burst
   of staff runs queues up. The audit trail's `duration_ms` is how that becomes visible; a rate limit is a
   follow-up, not part of this pass.
6. **`.reload`-class commands can outlive the 10-second timeout** while doing real work on the world
   thread. The default timeout is kept, and a timeout is recorded as `failed` / `timeout` even though the
   server may still finish the work — the trail records what the site observed, and the page's copy must not
   claim more than that.

## 13. Explicitly out of scope

- **Bans and mutes as first-class tools** (a ban list, a duration picker, an unban flow). This pass runs
  `ban`/`unban` as console commands with an audit trail; modelling them is the rest of roadmap item 4.
- **Any command that acts on a selected player or creature**, which a SOAP console call cannot supply
  (`§3.4`). The wiki says so explicitly.
- **A staff-facing view of another player's characters**, and per-realm scoping — both still future work.
- **Deleting game accounts**, unlinking from the staff side, and anything else the accounts design already
  declined.
- **Editing or pruning the audit trail**, in the UI or in code.
- **A generic "run any console line" box.** The catalogue is a whitelist on purpose; a free-text console is
  the same power without the record, and the rule in `AGENTS.md` is audit-first, not audit-optional.

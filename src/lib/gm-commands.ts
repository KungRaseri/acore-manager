/**
 * The GM command catalogue's vocabulary and policy overlay.
 *
 * Client-safe and pure on purpose, like [`access.ts`](src/lib/access.ts) and
 * [`characters.ts`](src/lib/characters.ts): the server reads the realm's own
 * rows (`acore_world.command`: `name`, `security`, `help`) and hands over plain
 * values, and everything in this module turns those into something a component
 * can render and a spec can test without a database.
 *
 * **This module is not the catalogue.** The catalogue is the realm's `command`
 * table, read per request, because the core adopts that table's `security` as a
 * command's required level (`ChatCommand.cpp:118-124`). A gate built on the
 * realm's number therefore matches what the realm itself would demand of an
 * in-game caller, and a realm that has retuned a command is respected instead
 * of contradicted. A committed list of the stock 699 commands would be exactly
 * the hardcoded list `AGENTS.md` rejects under _Characters_ — "names come from
 * the server, never from a list kept here" — and it would go stale silently.
 *
 * What is deliberately **absent** is any per-command security number. A
 * security number is an access input, and access inputs come from the realm or
 * from [`$lib/server/authz`](src/lib/server/authz.ts), never from a file this
 * project maintains. The one place a committed list does carry meaning is the
 * risk and deny list below, and that direction is safe by construction: the
 * overlay can remove commands from the runnable set or demand a typed
 * confirmation for them, but it can never declare runnable a command the realm
 * gates more strictly.
 */
import { SEC_ADMINISTRATOR, SEC_MODERATOR, tierForLevel, type AccessTier } from '$lib/access';

/**
 * How dangerous running a command through the site is judged to be.
 *
 * `blocked` is a decision rather than a severity: a blocked command is never
 * runnable. The middle two both require the actor to type the command name
 * before the form submits, so the difference between them is how loudly the
 * browser warns, not a different gate.
 */
export type CommandRisk = 'read-only' | 'mutating' | 'realm-affecting' | 'blocked';

/**
 * One row of the realm's `command` table, plus everything this site derives
 * from it.
 *
 * Built by the reader in `$lib/server/acore`, so the entry is a plain data
 * object: it crosses to the browser as load data and is never trusted for an
 * access decision on its own. `security` is kept alongside `tier` on purpose —
 * the tier is for badges and floors, while the raw number is what the audit row
 * records and what a "the realm says 3" explanation quotes.
 */
export interface GmCommand {
	/** The row's `name` — the token sequence after the dot, e.g. `account set gmlevel`. */
	name: string;
	/** The row's `security`, exactly as the realm stores it (0–4 in the stock table). */
	security: number;
	/** `tierForCommandLevel(security)`, or `null` when the realm declares a level above our ladder. */
	tier: AccessTier | null;
	/** The `Syntax:` line of `help`, prefix and newlines stripped, or `''` when there is none. */
	syntax: string;
	/** The rest of `help`, newlines normalised for display. */
	description: string;
	/** The name's first token: the realm's own category, e.g. `account`, `server`, `ban`. */
	group: string;
	/** Whether the syntax declares arguments — a display hint, never a validation rule. */
	takesArguments: boolean;
	/** Whether the command can be run through this site at all. */
	runnable: boolean;
	/** The overlay's classification. An unknown command is `mutating`, never `read-only`. */
	risk: CommandRisk;
	/** A sentence for the browser: the deny reason, or why the entry is outside our ladder. */
	note: string | null;
}

/**
 * What a page and its action need to know about the catalogue as a whole.
 *
 * `available` is `false` only when the table could not be read at all, which is
 * a different situation from a realm whose table is simply empty — the first is
 * a broken link that gets logged on every occurrence, the second is a property
 * of that realm.
 */
export interface CommandCatalogue {
	entries: GmCommand[];
	available: boolean;
}

/** The two halves a `help` value is split into. */
export interface ParsedHelp {
	/** The `Syntax:` line with its prefix removed, or `''` when the help has none. */
	syntax: string;
	/** Everything else, with newlines normalised and the outer whitespace trimmed. */
	description: string;
}

/**
 * Console output kept per audit row — **truncated**, not merely rendered short.
 *
 * A longer reply loses its tail, so both the column's documentation and the
 * page that shows it name this limit rather than letting the text appear to end
 * by itself. An unbounded column is the worse answer: this is text of unknown
 * size, produced by a command, landing in a table that is never pruned.
 */
export const MAX_AUDIT_OUTPUT_CHARS = 2000;

/**
 * The longest argument string the runner accepts.
 *
 * The same "bound the hostile input" habit as `validateExistingPassword`'s
 * 64-character limit in [`rules.ts`](src/lib/server/accounts/rules.ts): the
 * value is interpolated into a console line, and the server splits that line on
 * spaces. The rest of that rule — no control characters — belongs to the action,
 * which owns the parse.
 */
export const MAX_COMMAND_ARGUMENTS = 200;

/**
 * One entry of the policy overlay: the names it covers, the classification they
 * get, and the reason for it.
 *
 * The reason is not a log line; it is shown to staff as the explanation beside
 * a disabled command, so it says why in words a person reads.
 *
 * `matches` holds either an exact command name or a family written `family *`,
 * which covers both the bare family (`rbac`) and any subcommand of it
 * (`rbac list`). Rules are tried in order and the first match wins — which is
 * what makes the cancel aliases an exception rather than an accidental hole.
 */
export interface CommandPolicyRule {
	matches: readonly string[];
	risk: CommandRisk;
	reason: string;
}

/**
 * Commands this site refuses outright.
 *
 * The line is blast radius beyond the site's ability to undo, judged per stock
 * command: anything that hands out access, takes over an identity, moves a
 * character between accounts, or takes the realm down.
 */
export const DENIED_COMMANDS: readonly CommandPolicyRule[] = [
	{
		matches: ['account set gmlevel', 'rbac *'],
		risk: 'blocked',
		reason:
			"Privilege escalation: it grants GM levels, so a staff member could widen their own access and the site's ladder would stop describing anything."
	},
	{
		matches: ['account set password', 'account set email', 'account delete'],
		risk: 'blocked',
		reason:
			'Credential and identity takeover of an account: it changes how somebody signs in, and deletion is irreversible — this site has no restore path.'
	},
	{
		matches: ['character changeaccount'],
		risk: 'blocked',
		reason:
			'Hands a character to another account. That is an ownership change, and nothing on this site can undo it.'
	},
	{
		matches: ['server shutdown', 'server restart', 'server idlerestart'],
		risk: 'blocked',
		reason:
			'Takes the realm down, and this site has no way to bring it back up — the console credential sends commands, it does not start a server.'
	}
];

/**
 * Commands classified `read-only`: they observe and change nothing, so they run
 * from a single button while everything else needs the typed confirmation.
 *
 * The list is deliberately short. An unknown command is `mutating`, so the only
 * cost of omitting a query here is one extra confirmation step, whereas wrongly
 * calling a mutating command read-only would turn it into a one-click action.
 */
export const READ_ONLY_COMMANDS: readonly CommandPolicyRule[] = [
	{
		matches: ['list *', 'lookup *', 'mutehistory', 'server info', 'server motd'],
		risk: 'read-only',
		reason: 'A query: it reports state and changes none, so it runs from a single button.'
	}
];

/**
 * Commands classified `realm-affecting`: they act on the realm rather than on
 * one character, so the browser warns harder even though the gate is the same
 * as for `mutating`.
 */
export const REALM_AFFECTING_COMMANDS: readonly CommandPolicyRule[] = [
	{
		matches: [
			'server shutdown cancel',
			'server restart cancel',
			'server idleshutdown cancel',
			'server idlerestart cancel'
		],
		risk: 'realm-affecting',
		reason:
			'Cancels a realm-wide shutdown or restart timer. Deliberately left runnable while the commands that set the timer are blocked: these are the way back from a timer somebody else started, and blocking the antidote while blocking the poison helps nobody.'
	},
	{
		matches: ['reload *', 'announce'],
		risk: 'realm-affecting',
		reason:
			'Acts on the realm rather than on one character: a reload rebuilds shared tables on the world thread (and can outlive the SOAP timeout), and an announce reaches every player online.'
	}
];

/**
 * What an unclassified command gets.
 *
 * `mutating` rather than `read-only` is the whole point: defaulting to safe
 * would turn every command a future realm adds to its table into something a
 * moderator can fire with one click, and the confirmation is the only thing
 * standing between a typo and a live realm.
 */
export const DEFAULT_COMMAND_POLICY: CommandPolicyRule = {
	matches: ['*'],
	risk: 'mutating',
	reason:
		'Not classified by this overlay. An unknown command is assumed mutating, so it requires the typed confirmation rather than running in one click.'
};

/** Deny first: one name must never be both blocked and runnable. */
const POLICY_ORDER: readonly CommandPolicyRule[] = [
	...DENIED_COMMANDS,
	...READ_ONLY_COMMANDS,
	...REALM_AFFECTING_COMMANDS,
	DEFAULT_COMMAND_POLICY
];

/** The `Syntax:` marker, tolerant of the stock dump's `Syntax : ` spacing. */
const SYNTAX_PREFIX = /^syntax\s*:/i;

/**
 * Newlines in a `help` value are messy in practice, in two ways at once: the
 * shipped dump escapes them (a literal backslash-`r` backslash-`n`, because
 * that is what the SQL file contains), while the live column normally holds
 * real CR/LF once MySQL has interpreted those escapes. At least one stock row
 * even starts with a stray `\r`.
 *
 * Both forms are folded to a single `\n` here, so the split below can be
 * written for one kind of newline instead of four.
 */
function normaliseNewlines(text: string): string {
	return text.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n?/g, '\n');
}

/**
 * Splits a `help` value into its syntax line and its description.
 *
 * The stock table is not uniform: some rows lead with `Syntax:`, some put a
 * description first and the syntax after it, some use `Usage:`, and some have
 * no syntax at all (`TODO`, or a bare sentence). None of those may throw — the
 * core itself only logs them — so the rule is mechanical: the **first** line
 * carrying the `Syntax:` prefix is the syntax, and every other line is the
 * description. A continuation line after the syntax (the `#delay:` note under
 * `.server shutdown`) therefore stays in the description, which is also where a
 * reader wants it.
 *
 * `help` is nullable in the table, which is why the input is too.
 */
export function parseHelp(help: string | null | undefined): ParsedHelp {
	const normalised = normaliseNewlines(help ?? '').trim();

	if (normalised === '') {
		return { syntax: '', description: '' };
	}

	const lines = normalised.split('\n');
	const syntaxIndex = lines.findIndex((line) => SYNTAX_PREFIX.test(line.trim()));

	const syntaxLine = syntaxIndex === -1 ? undefined : lines[syntaxIndex];

	if (syntaxLine === undefined) {
		return { syntax: '', description: normalised };
	}

	const syntax = syntaxLine.trim().replace(SYNTAX_PREFIX, '').trim();
	const description = lines
		.filter((_, index) => index !== syntaxIndex)
		.join('\n')
		.trim();

	return { syntax, description };
}

/**
 * The name's first token — the realm's own category, since it names commands
 * that way (`account create`, `server shutdown`, `ban character`). Used to
 * group the browser without a second query, and never as a permission input.
 */
export function groupOf(name: string): string {
	const [first = ''] = name.trim().toLowerCase().split(/\s+/);

	return first;
}

/**
 * Whether the syntax text declares arguments.
 *
 * A hint, never a validation rule: `[ ]` marks optional arguments and `$`, `<`
 * and `#` mark required ones, but the realm is the only authority on what a
 * command wants. The site uses this to label the argument field and to refuse
 * the obviously-unsupported case — never to reject a command the realm would
 * have accepted.
 *
 * A help with no `Syntax:` line yields `false`, which makes the action refuse
 * supplied arguments. That is the restrictive direction, and therefore the safe
 * one for a value we could not read.
 */
export function syntaxDeclaresArguments(syntax: string): boolean {
	return /[[\]$<>#]/.test(syntax);
}

/**
 * The overlay's rule for a command: the first matching rule, or the
 * mutating-by-default fallback.
 *
 * Names are compared case-insensitively and with outer whitespace ignored,
 * because the table is data this project does not control and one realm's row
 * need not be cased like the stock dump's.
 */
export function policyFor(name: string): CommandPolicyRule {
	const match = POLICY_ORDER.find((rule) =>
		rule.matches.some((pattern) => matchesCommand(pattern, name))
	);

	return match ?? DEFAULT_COMMAND_POLICY;
}

/** The classification alone, for callers that do not need the reason. */
export function riskOf(name: string): CommandRisk {
	return policyFor(name).risk;
}

/**
 * `tierForLevel()`, except that a level above the site's ladder has no tier
 * rather than clamping to the top one.
 *
 * [`access.ts`](src/lib/access.ts) clamps on purpose — an unknown high level
 * must never grant more than administrator — but the catalogue needs the other
 * reading: a level-4 row is _outside_ the ladder and is listed as reference
 * only, and `'administrator'` would instead claim the site can run it.
 */
export function tierForCommandLevel(security: number): AccessTier | null {
	return security > SEC_ADMINISTRATOR ? null : tierForLevel(security);
}

/**
 * Whether a command can be run through this site at all.
 *
 * This is a property of the entry, not of the actor:
 *
 * 1. `security >= 1` — level 0 is player self-service, and through the site's
 *    console credential those commands act on the **console account** rather
 *    than on the caller (`account password` would change the SOAP account's own
 *    password), so they are never listed or run.
 * 2. `security <= SEC_ADMINISTRATOR` — the ceiling of the site's ladder.
 * 3. not `blocked` — the overlay's decision.
 *
 * Whether _this_ actor may run it is a different question, answered per request
 * by `requireCommandLevel()` in `authz`. The level passed to it came from the
 * realm, so a value the reader could not parse fails every comparison here and
 * closes rather than opens.
 */
export function isRunnable(command: Pick<GmCommand, 'security' | 'risk'>): boolean {
	return (
		command.risk !== 'blocked' &&
		command.security >= SEC_MODERATOR &&
		command.security <= SEC_ADMINISTRATOR
	);
}

/**
 * Whether the runner must have the actor type the command name before the form
 * submits.
 *
 * Derived from the risk so the form and the action cannot disagree: a
 * client-side guard is not a guard, and the action validates the same field
 * against the same rule (a forged POST that omits it is refused and audited).
 */
export function requiresConfirmation(risk: CommandRisk): boolean {
	return risk === 'mutating' || risk === 'realm-affecting';
}

/**
 * The sentence the browser shows beside a command it will not run, or `null`
 * for one it will.
 *
 * Kept here rather than in the page so the wording and the rule that produced
 * it live in one place, and so the same sentence reaches the trail and the
 * action's 403.
 */
export function noteFor(command: Pick<GmCommand, 'name' | 'security' | 'risk'>): string | null {
	if (command.risk === 'blocked') {
		return policyFor(command.name).reason;
	}

	// `isRunnable` fails closed on a level it could not read, and without this
	// branch such an entry would be disabled with no explanation at all —
	// "shown disabled, with the reason" is the promise the browser makes.
	if (!Number.isFinite(command.security)) {
		return 'The realm reported no usable gmlevel for this command, so it is never run from here.';
	}

	if (command.security < SEC_MODERATOR) {
		return "Level 0 — player self-service. Through the site's console account these act on that account, not on the caller, so they are never run from here.";
	}

	if (command.security > SEC_ADMINISTRATOR) {
		return `The realm declares gmlevel ${command.security}, above this site's ladder (it stops at SEC_ADMINISTRATOR, 3). Shown for reference only.`;
	}

	return null;
}

/** `*` matches anything; `family *` matches the family itself and its subcommands. */
function matchesCommand(pattern: string, name: string): boolean {
	const normalisedName = name.trim().toLowerCase();
	const normalisedPattern = pattern.trim().toLowerCase();

	if (normalisedPattern === '*') {
		return true;
	}

	if (normalisedPattern.endsWith(' *')) {
		const family = normalisedPattern.slice(0, -2);

		return normalisedName === family || normalisedName.startsWith(`${family} `);
	}

	return normalisedName === normalisedPattern;
}

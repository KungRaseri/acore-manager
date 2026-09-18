import type { RowDataPacket } from 'mysql2';
import {
	groupOf,
	isRunnable,
	noteFor,
	parseHelp,
	riskOf,
	syntaxDeclaresArguments,
	tierForCommandLevel,
	type CommandCatalogue,
	type GmCommand
} from '$lib/gm-commands';
import { getAcoreWorldDb } from '$lib/server/db/acore';

/**
 * The realm's GM command catalogue, read out of `acore_world.command`.
 *
 * The realm is the only authority on which commands exist and what level each
 * one demands: the core adopts that table's `security` as the command's own
 * required level at boot (`ChatCommand.cpp:118-124`), so a gate built on the
 * realm's number matches what the realm itself would ask of an in-game caller,
 * and a realm that has retuned a command is respected rather than contradicted.
 * [`$lib/gm-commands`](src/lib/gm-commands.ts) holds the vocabulary and the
 * policy overlay; this module is the reader that turns rows into entries, and it
 * deliberately holds **no** per-command security number of its own.
 *
 * One `SELECT`, read-only, on the same lazy pool as every other AzerothCore read
 * — and **nothing is cached**. The rule `$lib/server/authz` sets for GM levels
 * applies here for the same reason: a level a realm has retuned should apply to
 * the next request, not to the next deployment.
 *
 * ## Reading a table we do not own, for an access decision
 *
 * This is the question a reviewer should ask, and the answer is that it adds no
 * new consumer of untrusted data: the core reads the same rows for the same
 * purpose and adopts the same numbers, so anyone who can write to `command` can
 * already change what the realm's commands require.
 *
 * ## The failure modes, and why they all close
 *
 * - **The table cannot be read** (no `ACORE_DATABASE_URL`, MySQL down, no
 *   `SELECT` grant) → the catalogue is **unavailable**, nothing is runnable, and
 *   the failure is logged on every occurrence, because a broken link is worth
 *   repeating.
 * - **The table reads but holds no usable row** → the same empty console and
 *   nothing runnable, logged **once per process**, because an empty table is a
 *   property of that realm rather than of the request (the
 *   [`warnIfNoIconsAtAll`](src/lib/server/characters/reference.ts) precedent).
 * - **A command the realm's core knows but the table does not** → `findCommand`
 *   returns `null`, so it is never run. The name comes from the catalogue, and
 *   that whitelist failing closed is what keeps the console safe.
 *
 * There is deliberately **no fallback to a committed command list**. A second
 * source of truth for an access decision is the thing this project forbids, and
 * a stale fallback is worse than an honest empty state: it would offer commands
 * at levels the realm may no longer honour.
 */

/**
 * One row of the realm's `command` table, as the MySQL driver hands it back.
 *
 * The three fields are typed `unknown` on purpose. This is data this project
 * does not own, so a value the table was not supposed to hold has to be rejected
 * by [`toCommandEntry`](#toCommandEntry) rather than trusted through a cast.
 */
export interface RawCommandRow {
	name: unknown;
	security: unknown;
	help: unknown;
}

/** `RawCommandRow` as `mysql2` returns it. */
type CommandRow = RawCommandRow & RowDataPacket;

/**
 * The core's own statement (`WORLD_SEL_COMMANDS`, `WorldDatabase.cpp`), plus the
 * ordering the catalogue wants: `name` is the primary key, so this stays an
 * index-ordered read of a few hundred rows.
 */
const SELECT_COMMANDS = 'SELECT name, security, help FROM command ORDER BY name';

/**
 * The row's name with outer whitespace removed and internal runs collapsed.
 *
 * The name is both the catalogue's key and a fragment of the console line this
 * site builds, and the server splits a command on spaces — so a name carrying a
 * stray run of whitespace would reach the realm as a different command than the
 * one that was looked up. Collapsing cannot rename a real command: no command's
 * token sequence contains a meaningful run of whitespace.
 */
function normaliseName(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

/**
 * [`normaliseName`](#normaliseName), folded for comparison only.
 *
 * The entry keeps the realm's own spelling, because that is what the console
 * should receive and what a reader should see.
 */
function foldName(value: string): string {
	return normaliseName(value).toLowerCase();
}

/**
 * The realm's `security` as a level, or `NaN` when it is not a level at all.
 *
 * `NaN` is the fail-closed answer rather than `0`: every comparison in
 * `isRunnable` rejects it and `noteFor` has a branch for it, so a value that
 * could not be read is reported as unreadable instead of being quietly treated
 * as "no staff level" — `0` would claim the realm meant a player command.
 */
function toSecurityLevel(value: unknown): number {
	let parsed: number;

	if (typeof value === 'number') {
		parsed = value;
	} else if (typeof value === 'string' && value.trim() !== '') {
		// `tinyint unsigned NOT NULL` should always arrive as a number, but the
		// value is not ours to assume: a numeric string is still a level.
		parsed = Number(value);
	} else {
		parsed = Number.NaN;
	}

	/*
		Only a non-negative integer is a level this site will act on. A negative or
		fractional value would have to be clamped or rounded to compare, and either
		invents a number the realm did not declare — in the direction that lets more
		people run the command.
	*/
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

/**
 * One row as the catalogue lists it, or `null` when the row carries nothing
 * usable.
 *
 * Pure and database-free on purpose, following the
 * [`reference.ts`](src/lib/server/characters/reference.ts) habit of keeping the
 * query thin and its interpretation testable: every branch below is a value the
 * realm could actually hold, and each one has to close rather than open.
 *
 * A row with no name is **dropped** rather than listed. The name is the
 * catalogue's key, the lookup the action performs, and the only fragment of a
 * command line this site builds — a blank key can be neither found nor safely
 * run.
 */
export function toCommandEntry(row: RawCommandRow): GmCommand | null {
	const name = typeof row.name === 'string' ? normaliseName(row.name) : '';

	if (name === '') {
		return null;
	}

	const security = toSecurityLevel(row.security);
	const risk = riskOf(name);
	const { syntax, description } = parseHelp(typeof row.help === 'string' ? row.help : null);

	return {
		name,
		security,
		/*
			`tierForCommandLevel` answers for a level the realm declares. A level it
			did not report has no tier at all: `'player'` would claim the entry sits
			at the bottom of the ladder, when the honest reading is that it sits
			outside it.
		*/
		tier: Number.isFinite(security) ? tierForCommandLevel(security) : null,
		syntax,
		description,
		group: groupOf(name),
		takesArguments: syntaxDeclaresArguments(syntax),
		runnable: isRunnable({ security, risk }),
		risk,
		note: noteFor({ name, security, risk })
	};
}

/**
 * The catalogue's entry for `name`, or `null` when the realm has no such row.
 *
 * This lookup **is** the whitelist. The name a form submits is a key and never a
 * fragment of a command line: the line sent to the console is built from the
 * entry's own name, so a name that is not a row here is not runnable, and that
 * failure direction is closed by construction.
 *
 * Case and whitespace are folded, matching the table's own `utf8mb4_unicode_ci`
 * collation — the core resolves `.Kick` and `.kick` alike — which widens
 * nothing: the name still has to be a row of the realm's own table.
 */
export function findCommand(catalogue: CommandCatalogue, name: string): GmCommand | null {
	const wanted = foldName(name);

	if (wanted === '') {
		return null;
	}

	return catalogue.entries.find((entry) => foldName(entry.name) === wanted) ?? null;
}

/*
	Once per process, because an empty `command` table is a property of that realm
	and not of the request: with no rows, every page render would otherwise repeat
	the same warning. The same reasoning as `warnIfNoIconsAtAll` in
	`$lib/server/characters/reference`.
*/
let warnedAboutMissingCommands = false;

function warnIfNoCommandsAtAll(): void {
	if (warnedAboutMissingCommands) {
		return;
	}

	warnedAboutMissingCommands = true;
	console.warn(
		'[commands] acore_world.command returned no usable rows, so the GM command catalogue is empty and nothing is runnable. AzerothCore ships that table in data/sql/base/db_world/command.sql, so an empty one usually means the world database was imported without it.'
	);
}

/** The rows, or `null` when the table could not be read at all. */
async function selectCommandRows(): Promise<CommandRow[] | null> {
	try {
		const [rows] = await getAcoreWorldDb().query<CommandRow[]>(SELECT_COMMANDS);

		return rows;
	} catch (cause) {
		/*
			A broken link rather than a property of the realm, so it is logged on
			every occurrence — the `$lib/server/authz` precedent. Failing closed is
			the point: with no rows there is nothing to look a command up in, so
			nothing is runnable, and no fallback list may stand in for the realm.
		*/
		console.error(
			'[commands] could not read acore_world.command, so the GM command catalogue is unavailable and nothing is runnable',
			cause
		);

		return null;
	}
}

/**
 * The realm's whole command table, read afresh on every call.
 *
 * `available` reports whether the table could be **read**, not whether it held
 * anything: a realm whose table is empty has answered, and the page can say that
 * rather than blaming a broken connection. Both states leave `entries` empty, so
 * both leave nothing runnable — the difference is only what can be explained and
 * how often the log repeats itself.
 */
export async function readCommandCatalogue(): Promise<CommandCatalogue> {
	const rows = await selectCommandRows();

	if (rows === null) {
		return { entries: [], available: false };
	}

	const entries = rows.map(toCommandEntry).filter((entry): entry is GmCommand => entry !== null);

	if (entries.length === 0) {
		warnIfNoCommandsAtAll();
	}

	return { entries, available: true };
}

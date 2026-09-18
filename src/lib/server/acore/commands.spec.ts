import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findCommand, readCommandCatalogue, toCommandEntry, type RawCommandRow } from './commands';

/*
	The AzerothCore pool is stubbed, so this spec runs with **no MySQL anywhere
	near it**. `vi.mock` is hoisted above the imports by Vitest, and `vi.hoisted`
	gives the stub somewhere to live before that factory runs — the same arrangement
	as `src/lib/navigation.spec.ts`.
*/
const { query } = vi.hoisted(() => ({
	query: vi.fn<(sql: string, values?: unknown[]) => Promise<[unknown[], unknown[]]>>()
}));

vi.mock('$lib/server/db/acore', () => ({
	getAcoreWorldDb: () => ({ query })
}));

/**
 * Fixtures are rows quoted **verbatim** from AzerothCore's stock world database
 * dump, `azerothcore-wotlk/data/sql/base/db_world/command.sql` (read 2026-09-18;
 * the same provenance and the same text as `src/lib/gm-commands.spec.ts`, which
 * quotes them for `parseHelp`). Each names its line and its security so the
 * citation can be re-checked rather than trusted.
 */
const KICK_HELP =
	'Syntax: .kick [$charactername] [$reason]\\r\\n\\r\\nKick the given character name from the world with or without reason. If no character name is provided then the selected player (except for yourself) will be kicked. If no reason is provided, default is "No Reason".';

/** command.sql:649 — `server shutdown`, security 3, as MySQL stores it (real CR/LF). */
const SERVER_SHUTDOWN_HELP =
	'Syntax: .server shutdown #delay [#exit_code]\r\nShut the server down after #delay. Use #exit_code or 0 as program exit code.\n#delay: use a timestring like "1h15m30s".';

/** command.sql:316 — `kick`, security 2. */
const KICK_ROW: RawCommandRow = { name: 'kick', security: 2, help: KICK_HELP };

/** command.sql:649 — `server shutdown`, security 3, blocked by the overlay. */
const SHUTDOWN_ROW: RawCommandRow = {
	name: 'server shutdown',
	security: 3,
	help: SERVER_SHUTDOWN_HELP
};

/** MySQL's `mysql2` answer shape: the rows, then the field packets. */
function answering(...rows: RawCommandRow[]): [unknown[], unknown[]] {
	return [rows, []];
}

describe('toCommandEntry', () => {
	it('maps a stock row to an entry with everything the browser needs', () => {
		expect(toCommandEntry(KICK_ROW)).toEqual({
			name: 'kick',
			security: 2,
			tier: 'game-master',
			syntax: '.kick [$charactername] [$reason]',
			description:
				'Kick the given character name from the world with or without reason. If no character name is provided then the selected player (except for yourself) will be kicked. If no reason is provided, default is "No Reason".',
			group: 'kick',
			takesArguments: true,
			runnable: true,
			risk: 'mutating',
			note: null
		});
	});

	it('drops a row whose name could not be read', () => {
		// The name is the catalogue's key and the only fragment of a command line
		// this site builds, so a row without one can be neither found nor run.
		expect(toCommandEntry({ name: null, security: 2, help: KICK_HELP })).toBeNull();
		expect(toCommandEntry({ name: '   ', security: 2, help: KICK_HELP })).toBeNull();
		expect(toCommandEntry({ name: 42, security: 2, help: KICK_HELP })).toBeNull();
		expect(toCommandEntry({ name: undefined, security: 2, help: null })).toBeNull();
	});

	it('collapses whitespace in a name and groups by its first token', () => {
		const entry = toCommandEntry({ name: '  account   create ', security: 3, help: null });

		expect(entry?.name).toBe('account create');
		expect(entry?.group).toBe('account');
	});

	it('has no tier for a level above the site’s ladder', () => {
		// A level-4 row is listed for reference and never run: the site's ladder
		// stops at administrator, which is also what its SOAP credential is.
		const entry = toCommandEntry({ name: 'account create', security: 4, help: null });

		expect(entry?.tier).toBeNull();
		expect(entry?.security).toBe(4);
		expect(entry?.runnable).toBe(false);
		expect(entry?.note).toContain('reference only');
	});

	it('treats a garbled, negative or fractional level as unreadable', () => {
		const unreadable: unknown[] = ['not-a-number', -1, 2.9, null, undefined, true, {}];

		for (const security of unreadable) {
			const entry = toCommandEntry({ name: 'kick', security, help: null });

			expect(entry?.security).toBeNaN();
			expect(entry?.tier).toBeNull();
			expect(entry?.runnable).toBe(false);
			expect(entry?.note).toContain('no usable gmlevel');
		}
	});

	it('accepts a level the driver hands back as a numeric string', () => {
		const entry = toCommandEntry({ name: 'kick', security: '2', help: null });

		expect(entry?.security).toBe(2);
		expect(entry?.runnable).toBe(true);
	});

	it('never lists a level-0 command as runnable', () => {
		// Level 0 is player self-service: through the site's console credential
		// these act on the console account rather than on the caller.
		const entry = toCommandEntry({ name: 'account password', security: 0, help: null });

		expect(entry?.runnable).toBe(false);
		expect(entry?.note).toContain('player self-service');
	});

	it('carries the deny reason for a command the overlay blocks', () => {
		const entry = toCommandEntry(SHUTDOWN_ROW);

		expect(entry?.risk).toBe('blocked');
		expect(entry?.tier).toBe('administrator');
		expect(entry?.runnable).toBe(false);
		expect(entry?.note).toContain('Takes the realm down');
	});

	it('tolerates a NULL help', () => {
		// `server info` is a stock name; the help is the NULL branch under test.
		const entry = toCommandEntry({ name: 'server info', security: 1, help: null });

		expect(entry?.syntax).toBe('');
		expect(entry?.description).toBe('');
		// No syntax means no declared arguments, so the action refuses any supplied.
		expect(entry?.takesArguments).toBe(false);
		expect(entry?.risk).toBe('read-only');
		expect(entry?.runnable).toBe(true);
		expect(entry?.note).toBeNull();
	});

	it('ignores a help that is not a string rather than throwing', () => {
		expect(toCommandEntry({ name: 'kick', security: 2, help: 7 })?.syntax).toBe('');
	});
});

describe('findCommand', () => {
	const catalogue = {
		entries: [toCommandEntry(KICK_ROW), toCommandEntry(SHUTDOWN_ROW)].filter(
			(entry) => entry !== null
		),
		available: true
	};

	it('finds a catalogue row by name', () => {
		expect(findCommand(catalogue, 'kick')?.security).toBe(2);
		expect(findCommand(catalogue, 'server shutdown')?.risk).toBe('blocked');
	});

	it('folds case and whitespace, the way the table’s own collation does', () => {
		expect(findCommand(catalogue, '  KICK ')?.name).toBe('kick');
		expect(findCommand(catalogue, 'SERVER   shutdown')?.name).toBe('server shutdown');
	});

	it('returns null for a name the realm does not list, so it can never run', () => {
		// The lookup is the whitelist: a command the core knows but the realm's
		// table does not is absent here and therefore not runnable.
		expect(findCommand(catalogue, 'account create')).toBeNull();
		expect(findCommand(catalogue, '')).toBeNull();
		expect(findCommand(catalogue, '   ')).toBeNull();
		expect(findCommand({ entries: [], available: true }, 'kick')).toBeNull();
	});
});

describe('readCommandCatalogue', () => {
	beforeEach(() => {
		query.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/*
		The empty-table warning is once per process, and the flag is deliberately
		not resettable — production behaviour is what is under test — so this has to
		be the first test in the file that reaches that branch. Every later test that
		reaches it can still assert the shape, just not the warning.
	*/
	it('warns once per process when the table reads but holds nothing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		query.mockResolvedValue(answering());

		const first = await readCommandCatalogue();

		expect(first).toEqual({ entries: [], available: true });
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('command.sql');

		// A second render must not repeat it: an empty table is a property of that
		// realm, not of the request.
		expect(await readCommandCatalogue()).toEqual({ entries: [], available: true });
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('reports an unreadable table as unavailable and logs every occurrence', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		query.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3306'));

		expect(await readCommandCatalogue()).toEqual({ entries: [], available: false });
		expect(await readCommandCatalogue()).toEqual({ entries: [], available: false });

		// A broken link rather than a realm property, so it is worth repeating.
		expect(error).toHaveBeenCalledTimes(2);
		expect(String(error.mock.calls[0][0])).toContain('acore_world.command');
	});

	it('never falls back to a committed list when the realm cannot be read', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		query.mockRejectedValue(new Error('no SELECT grant'));

		const catalogue = await readCommandCatalogue();

		// Both names are known to the committed policy overlay — `kick` is not in
		// it and `server info` is — and neither may be offered from it.
		expect(catalogue.entries).toEqual([]);
		expect(findCommand(catalogue, 'server info')).toBeNull();
		expect(findCommand(catalogue, 'kick')).toBeNull();
	});

	it('reads the realm’s table with a single parameterless SELECT', async () => {
		query.mockResolvedValue(answering(KICK_ROW, SHUTDOWN_ROW));

		const catalogue = await readCommandCatalogue();

		expect(query).toHaveBeenCalledTimes(1);
		expect(query.mock.calls[0][1]).toBeUndefined();

		const sql = query.mock.calls[0][0];

		expect(sql.trimStart().startsWith('SELECT')).toBe(true);
		expect(sql).toContain('FROM command');
		expect(catalogue.available).toBe(true);
		expect(catalogue.entries.map((entry) => entry.name)).toEqual(['kick', 'server shutdown']);
	});

	it('drops rows it cannot name, and still reports the table as read', async () => {
		query.mockResolvedValue(answering({ name: '', security: 3, help: null }));

		expect(await readCommandCatalogue()).toEqual({ entries: [], available: true });
	});
});

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_COMMAND_POLICY,
	DENIED_COMMANDS,
	MAX_AUDIT_OUTPUT_CHARS,
	READ_ONLY_COMMANDS,
	REALM_AFFECTING_COMMANDS,
	groupOf,
	isRunnable,
	noteFor,
	parseHelp,
	policyFor,
	requiresConfirmation,
	riskOf,
	syntaxDeclaresArguments,
	tierForCommandLevel
} from './gm-commands';

/**
 * The fixtures below are rows quoted **verbatim** from AzerothCore's stock
 * world database dump, `azerothcore-wotlk/data/sql/base/db_world/command.sql`
 * (read from the sibling checkout at `../azerothcore-wotlk` on 2026-09-18; the
 * same file upstream is `data/sql/base/db_world/command.sql`). Each fixture
 * names its line in that file and the row's security, so the citation can be
 * re-checked rather than trusted.
 *
 * The dump writes newlines as the literal escapes `\r\n`, and MySQL turns those
 * into real CR/LF when the file is loaded — so `parseHelp()` meets both forms:
 * a value read from a live column has the characters, while a fixture written
 * from the dump has the escapes. Both are represented here, unchanged; nothing
 * in this file is invented text.
 */
const ACCOUNT_CREATE_HELP =
	'Syntax: .account create $account $password $email\\r\\n\\r\\nCreate account and set password to it.\\r\\n$email is optional, can be left blank.';

/** command.sql:649 — `server shutdown`, security 3, as MySQL stores it (real CR/LF). */
const SERVER_SHUTDOWN_HELP =
	'Syntax: .server shutdown #delay [#exit_code]\r\nShut the server down after #delay. Use #exit_code or 0 as program exit code.\n#delay: use a timestring like "1h15m30s".';

/** command.sql:316 — `kick`, security 2. */
const KICK_HELP =
	'Syntax: .kick [$charactername] [$reason]\\r\\n\\r\\nKick the given character name from the world with or without reason. If no character name is provided then the selected player (except for yourself) will be kicked. If no reason is provided, default is "No Reason".';

/** command.sql:151 — `debug anim`, security 3: a help with no syntax at all. */
const DEBUG_ANIM_HELP = 'TODO';

/** command.sql:697 — `ticket viewname`, security 2: `Usage:`, not `Syntax:`. */
const TICKET_VIEWNAME_HELP =
	'Usage: .ticket viewname $creatorname. \\r\\nReturns details about specified ticket. Ticket must be open and not deleted.';

/** command.sql:708 — `unban ip`, security 3: the dump spaces the prefix `Syntax :`. */
const UNBAN_IP_HELP = 'Syntax : .unban ip $Ip\\r\\nUnban accounts for IP pattern.';

/** command.sql:690 — `ticket response append`, security 2: the syntax line is not first. */
const TICKET_RESPONSE_APPEND_HELP =
	'Add a response\\n\\nSyntax: ticket response append $ticketId $response';

describe('parseHelp', () => {
	it('splits the Syntax: line from the description in either newline form', () => {
		expect(parseHelp(ACCOUNT_CREATE_HELP)).toEqual({
			syntax: '.account create $account $password $email',
			description: 'Create account and set password to it.\n$email is optional, can be left blank.'
		});

		expect(parseHelp(SERVER_SHUTDOWN_HELP)).toEqual({
			syntax: '.server shutdown #delay [#exit_code]',
			description:
				'Shut the server down after #delay. Use #exit_code or 0 as program exit code.\n#delay: use a timestring like "1h15m30s".'
		});
	});

	it('drops the blank line the dump puts between the syntax and the description', () => {
		const parsed = parseHelp(KICK_HELP);

		expect(parsed.syntax).toBe('.kick [$charactername] [$reason]');
		expect(parsed.description).toBe(
			'Kick the given character name from the world with or without reason. If no character name is provided then the selected player (except for yourself) will be kicked. If no reason is provided, default is "No Reason".'
		);
	});

	it('reports no syntax when the help has none', () => {
		expect(parseHelp(DEBUG_ANIM_HELP)).toEqual({ syntax: '', description: 'TODO' });

		// `Usage:` is not the marker, so the whole text stays in the description
		// rather than being half-stripped into a syntax the realm never declared.
		// The space after `$creatorname.` is the dump's own: only the outer
		// whitespace of the description is trimmed, not each line of it.
		expect(parseHelp(TICKET_VIEWNAME_HELP)).toEqual({
			syntax: '',
			description:
				'Usage: .ticket viewname $creatorname. \nReturns details about specified ticket. Ticket must be open and not deleted.'
		});
	});

	it('accepts the spacing the dump uses in `Syntax : `', () => {
		expect(parseHelp(UNBAN_IP_HELP)).toEqual({
			syntax: '.unban ip $Ip',
			description: 'Unban accounts for IP pattern.'
		});
	});

	it('treats a syntax line that is not first as the syntax and keeps the rest', () => {
		expect(parseHelp(TICKET_RESPONSE_APPEND_HELP)).toEqual({
			syntax: 'ticket response append $ticketId $response',
			description: 'Add a response'
		});
	});

	it('does not throw on a NULL or whitespace-only help', () => {
		expect(parseHelp(null)).toEqual({ syntax: '', description: '' });
		expect(parseHelp(undefined)).toEqual({ syntax: '', description: '' });
		expect(parseHelp('')).toEqual({ syntax: '', description: '' });
		expect(parseHelp('   ')).toEqual({ syntax: '', description: '' });
	});
});

describe('groupOf', () => {
	it('takes the name’s first token as the group', () => {
		expect(groupOf('account set gmlevel')).toBe('account');
		expect(groupOf('server shutdown')).toBe('server');
		expect(groupOf('ban character')).toBe('ban');
		expect(groupOf('kick')).toBe('kick');
	});

	it('normalises casing and whitespace, and survives an empty name', () => {
		expect(groupOf('  Account   Create  ')).toBe('account');
		expect(groupOf('')).toBe('');
	});
});

describe('syntaxDeclaresArguments', () => {
	it('reads the dump’s optional and required markers as argument hints', () => {
		expect(syntaxDeclaresArguments('.kick [$charactername] [$reason]')).toBe(true);
		expect(syntaxDeclaresArguments('.account create $account $password $email')).toBe(true);
		expect(syntaxDeclaresArguments('.server shutdown #delay [#exit_code]')).toBe(true);
		expect(syntaxDeclaresArguments('.gobject add #id <spawntimeSecs>')).toBe(true);
	});

	it('reports no arguments for a bare syntax, or for no syntax at all', () => {
		expect(syntaxDeclaresArguments('.server info')).toBe(false);
		expect(syntaxDeclaresArguments('.reload all')).toBe(false);
		expect(syntaxDeclaresArguments('')).toBe(false);
	});
});

describe('the deny list', () => {
	it('blocks every command the design names, each with a readable reason', () => {
		const blocked = [
			'account set gmlevel',
			'account set password',
			'account set email',
			'account delete',
			'character changeaccount',
			'server shutdown',
			'server restart',
			'server idlerestart'
		];

		for (const name of blocked) {
			expect(riskOf(name)).toBe('blocked');
			expect(noteFor({ name, security: 3, risk: riskOf(name) })?.length).toBeGreaterThan(0);
		}
	});

	it('blocks the whole rbac family, bare name and subcommands alike', () => {
		// The stock dump may register none of these; a realm that adds them gets
		// the same escalation answer as `account set gmlevel`.
		expect(riskOf('rbac')).toBe('blocked');
		expect(riskOf('rbac list')).toBe('blocked');
	});

	it('states a reason for every rule in the overlay', () => {
		const rules = [
			...DENIED_COMMANDS,
			...READ_ONLY_COMMANDS,
			...REALM_AFFECTING_COMMANDS,
			DEFAULT_COMMAND_POLICY
		];

		for (const rule of rules) {
			expect(rule.reason.trim().length).toBeGreaterThan(0);
			expect(rule.matches.length).toBeGreaterThan(0);
		}
	});
});

describe('the cancel exception', () => {
	it('keeps the cancel aliases runnable while the timers they cancel are blocked', () => {
		const cancels = [
			'server shutdown cancel',
			'server restart cancel',
			'server idleshutdown cancel',
			'server idlerestart cancel'
		];

		for (const name of cancels) {
			expect(riskOf(name)).toBe('realm-affecting');
			expect(isRunnable({ security: 3, risk: riskOf(name) })).toBe(true);
		}

		expect(riskOf('server shutdown')).toBe('blocked');
		expect(riskOf('server restart')).toBe('blocked');
		expect(riskOf('server idlerestart')).toBe('blocked');
	});
});

describe('policyFor', () => {
	it('classifies an unknown command as mutating, never read-only', () => {
		expect(riskOf('some command a future realm adds')).toBe('mutating');
		expect(riskOf('realm_script_tool')).toBe('mutating');
		expect(riskOf('')).toBe('mutating');
	});

	it('classifies the query families as read-only', () => {
		expect(riskOf('server motd')).toBe('read-only');
		expect(riskOf('list item')).toBe('read-only');
		expect(riskOf('lookup player')).toBe('read-only');
		expect(riskOf('mutehistory')).toBe('read-only');
	});

	it('leaves the commands the design keeps on offer classified as mutating', () => {
		expect(riskOf('kick')).toBe('mutating');
		expect(riskOf('ban character')).toBe('mutating');
		expect(riskOf('unban account')).toBe('mutating');
		expect(riskOf('mute')).toBe('mutating');
		expect(riskOf('character rename')).toBe('mutating');
		expect(riskOf('send mail')).toBe('mutating');
	});

	it('treats the realm-wide tools as realm-affecting', () => {
		expect(riskOf('reload all')).toBe('realm-affecting');
		expect(riskOf('announce')).toBe('realm-affecting');
	});

	it('matches names case-insensitively and ignores surrounding whitespace', () => {
		expect(riskOf('  SERVER Shutdown ')).toBe('blocked');
		expect(riskOf('RELOAD All')).toBe('realm-affecting');
	});

	it('never returns a rule without a reason', () => {
		expect(policyFor('kick').reason.trim().length).toBeGreaterThan(0);
	});
});

describe('isRunnable', () => {
	it('refuses level 0 — player self-service — even when the risk is read-only', () => {
		// `server info` is security 0 in the dump (command.sql:642): through the
		// console credential it would report on the console account, not the caller.
		expect(isRunnable({ security: 0, risk: 'read-only' })).toBe(false);
	});

	it('refuses a level above the site’s ladder', () => {
		// `account create` is security 4 in the dump (command.sql:43).
		expect(isRunnable({ security: 4, risk: 'mutating' })).toBe(false);
		expect(isRunnable({ security: 5, risk: 'mutating' })).toBe(false);
	});

	it('accepts levels 1 to 3 when the risk is not blocked', () => {
		expect(isRunnable({ security: 1, risk: riskOf('appear') })).toBe(true);
		expect(isRunnable({ security: 2, risk: riskOf('kick') })).toBe(true);
		expect(isRunnable({ security: 3, risk: riskOf('reload all') })).toBe(true);
	});

	it('refuses a blocked command whatever level the realm declares', () => {
		expect(isRunnable({ security: 3, risk: riskOf('account set gmlevel') })).toBe(false);
	});

	it('fails closed on a level it could not read', () => {
		expect(isRunnable({ security: Number.NaN, risk: 'mutating' })).toBe(false);
		expect(isRunnable({ security: -1, risk: 'mutating' })).toBe(false);
	});
});

describe('requiresConfirmation', () => {
	it('demands the typed name for anything that changes state', () => {
		expect(requiresConfirmation('mutating')).toBe(true);
		expect(requiresConfirmation('realm-affecting')).toBe(true);
	});

	it('does not for a query, or for a refusal', () => {
		expect(requiresConfirmation('read-only')).toBe(false);
		expect(requiresConfirmation('blocked')).toBe(false);
	});
});

describe('noteFor', () => {
	it('explains a blocked command with the reason the list states', () => {
		expect(
			noteFor({
				name: 'character changeaccount',
				security: 3,
				risk: riskOf('character changeaccount')
			})
		).toBe(policyFor('character changeaccount').reason);
	});

	it('explains why level 0 and a level above the ladder are outside this site', () => {
		// `account password` is security 0 (command.sql:48); `account create` is 4.
		expect(
			noteFor({ name: 'account password', security: 0, risk: riskOf('account password') })
		).toContain('Level 0');
		expect(
			noteFor({ name: 'account create', security: 4, risk: riskOf('account create') })
		).toContain('gmlevel 4');
	});

	it('explains a command whose level the realm did not report usably', () => {
		expect(noteFor({ name: 'kick', security: Number.NaN, risk: 'mutating' })).toContain(
			'usable gmlevel'
		);
	});

	it('is null for a command the site will run', () => {
		expect(noteFor({ name: 'kick', security: 2, risk: riskOf('kick') })).toBeNull();
		expect(noteFor({ name: 'reload all', security: 3, risk: riskOf('reload all') })).toBeNull();
	});
});

describe('tierForCommandLevel', () => {
	it('maps the ladder and refuses to clamp a level above it', () => {
		expect(tierForCommandLevel(0)).toBe('player');
		expect(tierForCommandLevel(1)).toBe('moderator');
		expect(tierForCommandLevel(2)).toBe('game-master');
		expect(tierForCommandLevel(3)).toBe('administrator');
		// `tierForLevel` clamps to administrator on purpose; the catalogue must not,
		// because a level-4 row is listed for reference and is never runnable.
		expect(tierForCommandLevel(4)).toBeNull();
		expect(tierForCommandLevel(99)).toBeNull();
	});
});

describe('the shared limits', () => {
	it('pins the output truncation that the column and the pages both name', () => {
		expect(MAX_AUDIT_OUTPUT_CHARS).toBe(2000);
	});
});

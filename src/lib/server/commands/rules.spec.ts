import { describe, expect, it } from 'vitest';
import { MAX_COMMAND_ARGUMENTS } from '$lib/gm-commands';
import { confirmationMatches, validateCommandArguments } from './rules';

/*
	The syntaxes below are the realm's own (`GmCommand.syntax`), quoted from the
	fixtures in `src/lib/gm-commands.spec.ts`, which take them verbatim from
	AzerothCore's stock `data/sql/base/db_world/command.sql`. Using the realm's
	real syntax matters here: the "declares no arguments" branch depends on how
	the table writes a command that takes none.
*/
const NO_ARGUMENT_SYNTAX = '.server info';
const OPTIONAL_ARGUMENT_SYNTAX = '.kick [$charactername] [$reason]';

describe('validateCommandArguments', () => {
	it('accepts an empty string, because plenty of commands take no arguments', () => {
		expect(validateCommandArguments('', NO_ARGUMENT_SYNTAX)).toEqual({ ok: true, value: '' });
	});

	it('trims the surrounding space and returns the value the console will receive', () => {
		expect(validateCommandArguments('  Thrall  ', OPTIONAL_ARGUMENT_SYNTAX)).toEqual({
			ok: true,
			value: 'Thrall'
		});
	});

	it('refuses a control character, including a line break the console would send on', () => {
		expect(validateCommandArguments('Thrall\nserver shutdown 1', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(
			false
		);
		expect(validateCommandArguments('Thrall\rreason', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
		expect(validateCommandArguments('Thrall\treason', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
		// DEL and the C1 block are refused with the rest: the value is one line of
		// console input, and nothing above 0x7E belongs in it.
		expect(validateCommandArguments('Thrall\u007f', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
		expect(validateCommandArguments('Thrall\u0085', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
	});

	it('refuses a trailing newline rather than trimming it away', () => {
		expect(validateCommandArguments('Thrall\n', OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
	});

	it('bounds the value at the limit the audit row also enforces', () => {
		const longest = 'a'.repeat(MAX_COMMAND_ARGUMENTS);

		expect(validateCommandArguments(longest, OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(true);
		expect(validateCommandArguments(`${longest}a`, OPTIONAL_ARGUMENT_SYNTAX).ok).toBe(false);
	});

	it("refuses arguments the realm's syntax says the command does not take", () => {
		expect(validateCommandArguments('anything', NO_ARGUMENT_SYNTAX).ok).toBe(false);

		// A help with no `Syntax:` line declares none either, and refusing a value
		// this site could not check is the restrictive direction.
		expect(validateCommandArguments('anything', '').ok).toBe(false);
	});

	it('treats a whitespace-only value as no arguments at all', () => {
		expect(validateCommandArguments('   ', NO_ARGUMENT_SYNTAX)).toEqual({ ok: true, value: '' });
	});
});

describe('confirmationMatches', () => {
	it('accepts the command name as the catalogue spells it', () => {
		expect(confirmationMatches('server shutdown cancel', 'server shutdown cancel')).toBe(true);
	});

	it('ignores outer whitespace and case, the way the catalogue folds a name', () => {
		expect(confirmationMatches('  KICK  ', 'kick')).toBe(true);
	});

	it('never matches an empty value, so an omitted field cannot pass as a confirmation', () => {
		expect(confirmationMatches('', 'kick')).toBe(false);
		expect(confirmationMatches('   ', 'kick')).toBe(false);
	});

	it('refuses a different command, including one the typed name merely prefixes', () => {
		expect(confirmationMatches('ban', 'kick')).toBe(false);
		expect(confirmationMatches('kick', 'kick player')).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import {
	MAX_EMAIL_LENGTH,
	MAX_PASSWORD_LENGTH,
	MAX_USERNAME_LENGTH,
	emailsMatch,
	normalizeUsername,
	validateEmail,
	validateExistingPassword,
	validateNewPassword,
	validateUsername
} from './rules';

describe('normalizeUsername', () => {
	it('uppercases and trims, matching what the server stores', () => {
		expect(normalizeUsername('  thrall ')).toBe('THRALL');
	});
});

describe('validateUsername', () => {
	it('accepts an alphanumeric name and normalizes it', () => {
		const result = validateUsername('Jaina1');

		expect(result).toEqual({ ok: true, value: 'JAINA1' });
	});

	it('rejects a name containing a space', () => {
		// The server splits `account create <user> <pass>` on spaces, so a space
		// in the name would create a different account than the one asked for.
		expect(validateUsername('jaina proudmoore').ok).toBe(false);
	});

	it('rejects punctuation, which the console does not need to see', () => {
		expect(validateUsername('jaina!').ok).toBe(false);
	});

	it('rejects an empty name', () => {
		expect(validateUsername('   ').ok).toBe(false);
	});

	it('enforces the server length limit', () => {
		expect(validateUsername('a'.repeat(MAX_USERNAME_LENGTH)).ok).toBe(true);
		expect(validateUsername('a'.repeat(MAX_USERNAME_LENGTH + 1)).ok).toBe(false);
		expect(validateUsername('ab').ok).toBe(false);
	});
});

describe('validateNewPassword', () => {
	it('accepts a password within the server limits', () => {
		expect(validateNewPassword('Passw0rd!')).toEqual({ ok: true, value: 'Passw0rd!' });
	});

	it('rejects a password containing a space', () => {
		expect(validateNewPassword('pass word').ok).toBe(false);
	});

	it('rejects a password outside the length limits', () => {
		expect(validateNewPassword('short').ok).toBe(false);
		expect(validateNewPassword('a'.repeat(MAX_PASSWORD_LENGTH)).ok).toBe(true);
		expect(validateNewPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1)).ok).toBe(false);
	});
});

describe('validateExistingPassword', () => {
	it('accepts a password with spaces, because existing passwords are never put in a command line', () => {
		expect(validateExistingPassword('pass word').ok).toBe(true);
	});

	it('rejects an empty password', () => {
		expect(validateExistingPassword('').ok).toBe(false);
	});

	it('bounds the input so a hostile value cannot buy hashing time', () => {
		expect(validateExistingPassword('a'.repeat(65)).ok).toBe(false);
	});
});

describe('validateEmail', () => {
	it('accepts an address and trims the surrounding space', () => {
		expect(validateEmail('  thrall@example.com ')).toEqual({
			ok: true,
			value: 'thrall@example.com'
		});
	});

	it('rejects an empty address, because the account would have no recovery path', () => {
		expect(validateEmail('').ok).toBe(false);
	});

	it('rejects an address containing whitespace, which would split the command line', () => {
		expect(validateEmail('thrall @example.com').ok).toBe(false);
	});

	it('rejects a value that is not an address at all', () => {
		expect(validateEmail('thrall').ok).toBe(false);
	});

	it('enforces the server length limit', () => {
		expect(validateEmail(`${'a'.repeat(MAX_EMAIL_LENGTH)}@example.com`).ok).toBe(false);
	});
});

describe('emailsMatch', () => {
	it('matches the Discord address regardless of case or padding', () => {
		expect(emailsMatch(' Thrall@Example.COM ', 'thrall@example.com')).toBe(true);
	});

	it('does not match a different address', () => {
		expect(emailsMatch('jaina@example.com', 'thrall@example.com')).toBe(false);
	});

	it('never matches an empty stored address', () => {
		// Accounts that predate any email are common, and an unset field must not
		// read as proof of ownership.
		expect(emailsMatch('', 'thrall@example.com')).toBe(false);
		expect(emailsMatch('   ', 'thrall@example.com')).toBe(false);
	});
});

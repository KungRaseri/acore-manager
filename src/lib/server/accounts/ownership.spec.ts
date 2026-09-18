import { describe, expect, it } from 'vitest';
import { isOwnedByProfile } from './ownership';

/** A profile, spelled with the capitals Discord would send. */
const owner = { email: 'Player@Example.com' };

describe('isOwnedByProfile', () => {
	it('accepts an account this profile has linked, whatever address it carries', () => {
		expect(isOwnedByProfile({ email: 'somebody@else.com' }, owner, true)).toBe(true);
	});

	it('accepts an unlinked account carrying the profile address', () => {
		expect(isOwnedByProfile({ email: 'player@example.com' }, owner, false)).toBe(true);
	});

	it('refuses an unlinked account registered to somebody else', () => {
		expect(isOwnedByProfile({ email: 'somebody@else.com' }, owner, false)).toBe(false);
	});

	it('treats an account with no address as no claim at all', () => {
		// Many accounts predate any email; an empty field must not read as ownership.
		expect(isOwnedByProfile({ email: '' }, owner, false)).toBe(false);
	});
});

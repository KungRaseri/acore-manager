import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SALT_LENGTH, VERIFIER_LENGTH, calculateVerifier, verifierMatches } from './srp6';

const USERNAME = 'THRALL';
const PASSWORD = 'PASSW0RD';

function salt(): Buffer {
	// Fixed salt: the maths must be pure, so tests cannot depend on randomness.
	return Buffer.from(Array.from({ length: SALT_LENGTH }, (_, i) => i + 1));
}

describe('calculateVerifier', () => {
	it('produces a full-length verifier', () => {
		expect(calculateVerifier(USERNAME, PASSWORD, salt())).toHaveLength(VERIFIER_LENGTH);
	});

	it('is deterministic for the same inputs', () => {
		expect(calculateVerifier(USERNAME, PASSWORD, salt())).toEqual(
			calculateVerifier(USERNAME, PASSWORD, salt())
		);
	});

	it('is uppercase-insensitive, matching AccountMgr::CheckPassword', () => {
		// The server uppercases both the username and the password before the
		// hash, so `thrall`/`passw0rd` and `THRALL`/`PASSW0RD` are the same
		// credential.
		expect(calculateVerifier('thrall', 'passw0rd', salt())).toEqual(
			calculateVerifier(USERNAME, PASSWORD, salt())
		);
	});

	it('changes when the salt changes', () => {
		expect(calculateVerifier(USERNAME, PASSWORD, salt())).not.toEqual(
			calculateVerifier(USERNAME, PASSWORD, randomBytes(SALT_LENGTH))
		);
	});

	it('changes when either half of the credential changes', () => {
		const base = calculateVerifier(USERNAME, PASSWORD, salt());

		expect(calculateVerifier('JAINA', PASSWORD, salt())).not.toEqual(base);
		expect(calculateVerifier(USERNAME, 'PASSW0RDE', salt())).not.toEqual(base);
	});
});

describe('verifierMatches', () => {
	it('accepts the password the verifier was built from', () => {
		const s = salt();
		const stored = calculateVerifier(USERNAME, PASSWORD, s);

		expect(verifierMatches(USERNAME, PASSWORD, s, stored)).toBe(true);
	});

	it('accepts the credential as typed, whatever its case', () => {
		const s = salt();
		const stored = calculateVerifier(USERNAME, PASSWORD, s);

		expect(verifierMatches('thrall', 'Passw0rd', s, stored)).toBe(true);
	});

	it('rejects a wrong password', () => {
		const s = salt();

		expect(verifierMatches(USERNAME, 'WRONG', s, calculateVerifier(USERNAME, PASSWORD, s))).toBe(
			false
		);
	});

	it('rejects a verifier taken from a different account', () => {
		const s = salt();

		expect(verifierMatches(USERNAME, PASSWORD, s, calculateVerifier('JAINA', PASSWORD, s))).toBe(
			false
		);
	});

	it('rejects malformed stored values instead of throwing', () => {
		const s = salt();
		const stored = calculateVerifier(USERNAME, PASSWORD, s);

		expect(verifierMatches(USERNAME, PASSWORD, Buffer.alloc(4), stored)).toBe(false);
		expect(verifierMatches(USERNAME, PASSWORD, s, Buffer.alloc(4))).toBe(false);
	});
});

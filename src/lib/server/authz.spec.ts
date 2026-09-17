import { describe, expect, it } from 'vitest';
import type { Access, AccessTier } from '../access';
import { isServerManager, requireGameMaster, requireServerManager, requireStaff } from './authz';

/** The gmlevel each tier is reached at, matching `tierForLevel`. */
const LEVELS: Record<AccessTier, number> = {
	player: 0,
	moderator: 1,
	'game-master': 2,
	administrator: 3
};

function accessAt(tier: AccessTier): Access {
	return { tier, level: LEVELS[tier] };
}

/** The HTTP status a check refuses with, or 0 when it lets the caller through. */
function refusalStatus(check: () => void): number {
	try {
		check();
	} catch (thrown) {
		return (thrown as { status?: number }).status ?? 0;
	}

	return 0;
}

describe('isServerManager', () => {
	it('admits the administrator tier and nothing below it', () => {
		expect(isServerManager(accessAt('administrator'))).toBe(true);
		expect(isServerManager(accessAt('game-master'))).toBe(false);
		expect(isServerManager(accessAt('moderator'))).toBe(false);
		expect(isServerManager(accessAt('player'))).toBe(false);
	});
});

describe('requireStaff', () => {
	it('lets a moderator through', () => {
		expect(() => requireStaff(accessAt('moderator'))).not.toThrow();
	});

	it('refuses a player with a 403', () => {
		expect(refusalStatus(() => requireStaff(accessAt('player')))).toBe(403);
	});
});

describe('requireGameMaster', () => {
	it('lets a game master through', () => {
		expect(() => requireGameMaster(accessAt('game-master'))).not.toThrow();
	});

	it('refuses a moderator, the tier directly below', () => {
		expect(refusalStatus(() => requireGameMaster(accessAt('moderator')))).toBe(403);
	});
});

describe('requireServerManager', () => {
	it('lets an administrator through', () => {
		expect(() => requireServerManager(accessAt('administrator'))).not.toThrow();
	});

	it('refuses a game master, the tier directly below', () => {
		expect(refusalStatus(() => requireServerManager(accessAt('game-master')))).toBe(403);
	});
});

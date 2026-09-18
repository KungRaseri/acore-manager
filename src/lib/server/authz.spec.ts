import { describe, expect, it } from 'vitest';
import type { Access, AccessTier } from '../access';
import {
	isServerManager,
	requireCommandLevel,
	requireGameMaster,
	requireServerManager,
	requireStaff
} from './authz';

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

describe('requireCommandLevel', () => {
	it('lets an actor whose own level reaches the command’s through', () => {
		expect(() => requireCommandLevel(accessAt('game-master'), 2)).not.toThrow();
		expect(() => requireCommandLevel(accessAt('administrator'), 1)).not.toThrow();
		expect(() => requireCommandLevel(accessAt('administrator'), 3)).not.toThrow();
	});

	it('refuses an actor below the level the realm declares', () => {
		expect(refusalStatus(() => requireCommandLevel(accessAt('moderator'), 2))).toBe(403);
		expect(refusalStatus(() => requireCommandLevel(accessAt('game-master'), 3))).toBe(403);
		expect(refusalStatus(() => requireCommandLevel(accessAt('player'), 1))).toBe(403);
	});

	it('leaves whether a command is runnable at all to the catalogue', () => {
		/*
			Level 0 is a comparison this helper answers; the rule that refuses a
			level-0 command is `isRunnable` in `$lib/gm-commands`. Duplicating that
			policy here is what would let the two drift apart.
		*/
		expect(() => requireCommandLevel(accessAt('player'), 0)).not.toThrow();
	});

	it('fails closed when the realm reported no usable level for the command', () => {
		const unreadable = Number.NaN;

		expect(refusalStatus(() => requireCommandLevel(accessAt('administrator'), unreadable))).toBe(
			403
		);
	});

	it('fails closed when the actor’s own level could not be read', () => {
		// An unreadable level arrives as `PLAYER_ACCESS` (0) in practice, and this
		// pins the comparison itself: a `NaN` on either side must refuse, not pass.
		const access = { tier: 'player', level: Number.NaN } as const;

		expect(refusalStatus(() => requireCommandLevel(access, 3))).toBe(403);
	});
});

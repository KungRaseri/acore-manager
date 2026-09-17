import { describe, expect, it } from 'vitest';
import {
	SEC_ADMINISTRATOR,
	SEC_CONSOLE,
	SEC_GAMEMASTER,
	SEC_MODERATOR,
	SEC_PLAYER,
	tierAtLeast,
	tierForLevel
} from './access';

describe('tierForLevel', () => {
	it('maps each AzerothCore level onto the ladder', () => {
		expect(tierForLevel(SEC_PLAYER)).toBe('player');
		expect(tierForLevel(SEC_MODERATOR)).toBe('moderator');
		expect(tierForLevel(SEC_GAMEMASTER)).toBe('game-master');
		expect(tierForLevel(SEC_ADMINISTRATOR)).toBe('administrator');
	});

	it('clamps a level above the known ladder instead of falling through', () => {
		// `SEC_CONSOLE` is the level above administrator, and anything AzerothCore
		// adds later lands here too: administrator is the ceiling this site grants,
		// so an unrecognised high level can never mean more than that.
		expect(tierForLevel(SEC_CONSOLE)).toBe('administrator');
		expect(tierForLevel(99)).toBe('administrator');
	});

	it('treats an unreadable level as a player', () => {
		expect(tierForLevel(-1)).toBe('player');
		expect(tierForLevel(Number.NaN)).toBe('player');
	});
});

describe('tierAtLeast', () => {
	it('orders the ladder', () => {
		expect(tierAtLeast('moderator', 'player')).toBe(true);
		expect(tierAtLeast('moderator', 'moderator')).toBe(true);
		expect(tierAtLeast('moderator', 'game-master')).toBe(false);
		expect(tierAtLeast('game-master', 'administrator')).toBe(false);
		expect(tierAtLeast('administrator', 'game-master')).toBe(true);
	});
});

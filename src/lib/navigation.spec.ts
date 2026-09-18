import { describe, expect, it, vi } from 'vitest';
import { isNavActive, mainNav, staffNav, visibleNav } from './navigation';

/*
	`navigation.ts` resolves each href once, where the nav data is defined. Importing
	the real `$app/paths` in this project's `node` test environment drags in
	SvelteKit's client runtime, which expects `window`, so it is stubbed with the
	identity function — which is also the honest assertion for this spec: what is
	under test is the tier filtering and the active-item rule, not the base path.
	`vi.mock` is hoisted above the imports, so the stub is in place before the module
	under test is loaded.
*/
vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

describe('visibleNav', () => {
	it('shows a player the player routes and no staff section at all', () => {
		expect(visibleNav(mainNav, 'player').map((item) => item.label)).toEqual([
			'Dashboard',
			'Game Accounts'
		]);
		expect(visibleNav(staffNav, 'player')).toEqual([]);
	});

	it('shows a moderator the staff home, moderation and the console, but not the tiers above', () => {
		expect(visibleNav(staffNav, 'moderator').map((item) => item.href)).toEqual([
			'/staff',
			'/staff/moderator',
			'/staff/moderator/commands'
		]);
	});

	it('adds the diagnostics section for a game master', () => {
		expect(visibleNav(staffNav, 'game-master').map((item) => item.href)).toEqual([
			'/staff',
			'/staff/moderator',
			'/staff/moderator/commands',
			'/staff/gm'
		]);
	});

	it('shows an administrator every section', () => {
		expect(visibleNav(staffNav, 'administrator')).toHaveLength(staffNav.length);
	});

	it('keeps the audit trail off both tiers below administrator', () => {
		const hrefsAt = (tier: Parameters<typeof visibleNav>[1]) =>
			visibleNav(staffNav, tier).map((item) => item.href);

		expect(hrefsAt('moderator')).not.toContain('/staff/admin/audit');
		expect(hrefsAt('game-master')).not.toContain('/staff/admin/audit');
		expect(hrefsAt('administrator')).toContain('/staff/admin/audit');
	});
});

describe('isNavActive', () => {
	it('keeps an exact item off its children', () => {
		const staffHome = staffNav[0];

		expect(isNavActive('/staff', staffHome)).toBe(true);
		// `/staff` must not light up while the visitor is one section further in.
		expect(isNavActive('/staff/gm', staffHome)).toBe(false);
	});
});

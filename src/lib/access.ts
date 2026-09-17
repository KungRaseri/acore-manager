/**
 * The access vocabulary: how an AzerothCore GM level becomes a tier, and what
 * that tier means.
 *
 * Deliberately free of any runtime dependency on `$lib/server`, so both the
 * server and the UI can name a tier from the same list — the route floors in
 * `src/routes/(staff)` are checked against these names by a spec, and the nav
 * filters on them.
 *
 * The numbers are AzerothCore's own `SEC_*` constants, as stored in
 * `acore_auth.account_access.gmlevel`. They are not ours to invent: a level the
 * server does not recognise is meaningless, so the ladder here is the server's
 * ladder with names for the site.
 */

/** AzerothCore's `SEC_PLAYER`: no staff access at all. */
export const SEC_PLAYER = 0;
/** AzerothCore's `SEC_MODERATOR`. */
export const SEC_MODERATOR = 1;
/** AzerothCore's `SEC_GAMEMASTER`. */
export const SEC_GAMEMASTER = 2;
/** AzerothCore's `SEC_ADMINISTRATOR` — the level the SOAP console itself demands. */
export const SEC_ADMINISTRATOR = 3;
/** AzerothCore's `SEC_CONSOLE`, the level above administrator. */
export const SEC_CONSOLE = 4;

/**
 * The site's tiers, in ascending order of capability.
 *
 * `player` is the tier of every user who is not staff, including a signed-in
 * visitor with no linked game account. There is no tier below it: an anonymous
 * visitor never reaches authorization at all, because sign-in comes first.
 */
export type AccessTier = 'player' | 'moderator' | 'game-master' | 'administrator';

/** Ascending, so a reader can see the ladder rather than infer it. */
export const TIER_ORDER: readonly AccessTier[] = [
	'player',
	'moderator',
	'game-master',
	'administrator'
] as const;

/** Human-readable names, for badges and page copy. */
export const TIER_LABELS: Record<AccessTier, string> = {
	player: 'Player',
	moderator: 'Moderator',
	'game-master': 'Game Master',
	administrator: 'Administrator'
};

const TIER_RANK: Record<AccessTier, number> = {
	player: 0,
	moderator: 1,
	'game-master': 2,
	administrator: 3
};

/**
 * Maps a `gmlevel` onto a tier.
 *
 * Written as descending thresholds rather than a switch on exact values so that
 * anything above `SEC_ADMINISTRATOR` — including a level AzerothCore adds later
 * — clamps to `administrator` instead of falling through to `player`, and
 * anything below `SEC_MODERATOR`, including a nonsense negative or `NaN`, lands
 * on `player`. Both directions are fail-safe: an unknown high level cannot grant
 * more than administrator, and an unreadable level cannot grant staff access.
 */
export function tierForLevel(level: number): AccessTier {
	if (level >= SEC_ADMINISTRATOR) {
		return 'administrator';
	}

	if (level >= SEC_GAMEMASTER) {
		return 'game-master';
	}

	if (level >= SEC_MODERATOR) {
		return 'moderator';
	}

	return 'player';
}

/** Whether `tier` is at or above `required` on the ladder. */
export function tierAtLeast(tier: AccessTier, required: AccessTier): boolean {
	return TIER_RANK[tier] >= TIER_RANK[required];
}

/**
 * What the app knows about a user's access.
 *
 * `level` is the effective `gmlevel` — the highest across every linked game
 * account — and is kept alongside the tier so the staff pages can show the real
 * number without re-reading AzerothCore.
 */
export interface Access {
	tier: AccessTier;
	level: number;
}

/** No session, no linked account, or an unreadable level. */
export const PLAYER_ACCESS: Access = { tier: 'player', level: SEC_PLAYER };

/**
 * The character vocabulary: how a number stored by AzerothCore becomes
 * something a person can read.
 *
 * Client-safe and pure on purpose, like [`access.ts`](src/lib/access.ts). The
 * server hands over plain values — copper, seconds, a quality id — and the
 * formatting happens here, so the same rules apply in a load and in a
 * component, and each one is testable without a database.
 *
 * Names are deliberately **not** here. Race, class, zone and skill names come
 * from the server's own `*_dbc` tables (`acore_world`), because the client
 * renders those same tables and a hardcoded list would drift from what players
 * see in game the moment a custom race or a renamed skill exists.
 */

/**
 * Item quality, as `item_template.Quality`, to a Skeleton text class.
 *
 * Colours only, no labels: the quality *name* is a client string, while the
 * colour is the part a player actually recognises. Tokens are used rather than
 * literal colours so the theme keeps control — the project rule is no hardcoded
 * colors.
 */
const QUALITY_CLASSES: Record<number, string> = {
	0: 'opacity-60',
	1: '',
	2: 'text-success-500',
	3: 'text-primary-500',
	4: 'text-secondary-500',
	5: 'text-tertiary-500',
	6: 'text-warning-500',
	7: 'text-warning-500'
};

export function qualityClass(quality: number): string {
	return QUALITY_CLASSES[quality] ?? '';
}

/**
 * Copper, as `characters.money`, to `1g 23s 45c`.
 *
 * Zero parts are dropped so ordinary amounts stay short, and an empty purse is
 * `0c` rather than an empty string, so a column never looks broken.
 */
export function formatMoney(copper: number): string {
	const total = Math.max(0, Math.trunc(copper));
	const gold = Math.floor(total / 10_000);
	const silver = Math.floor((total % 10_000) / 100);
	const copperLeft = total % 100;
	const parts: string[] = [];

	if (gold > 0) {
		parts.push(`${gold.toLocaleString('en-US')}g`);
	}

	if (silver > 0) {
		parts.push(`${silver}s`);
	}

	if (copperLeft > 0 || parts.length === 0) {
		parts.push(`${copperLeft}c`);
	}

	return parts.join(' ');
}

/**
 * Seconds, as `characters.totaltime` and `leveltime`, to `12d 3h 4m`.
 *
 * Minutes are the smallest unit shown: a playtime in seconds is noise, and the
 * database stores `totaltime` in seconds.
 */
export function formatPlaytime(seconds: number): string {
	const total = Math.max(0, Math.trunc(seconds));
	const days = Math.floor(total / 86_400);
	const hours = Math.floor((total % 86_400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const parts: string[] = [];

	if (days > 0) {
		parts.push(`${days}d`);
	}

	if (hours > 0) {
		parts.push(`${hours}h`);
	}

	if (minutes > 0 || parts.length === 0) {
		parts.push(`${minutes}m`);
	}

	return parts.join(' ');
}

/**
 * The equipment slots AzerothCore keeps inline, named as the client names them.
 *
 * The order is the server's own (`EQUIPMENT_SLOT_*` in `Player.h`, 0 through 18,
 * ending at `EQUIPMENT_SLOT_END`). The two finger and two trinket slots share a
 * label because they are the same thing to a player — the distinction is only
 * which of the pair an item sits in.
 */
const SLOT_LABELS: Record<number, string> = {
	0: 'Head',
	1: 'Neck',
	2: 'Shoulders',
	3: 'Shirt',
	4: 'Chest',
	5: 'Waist',
	6: 'Legs',
	7: 'Feet',
	8: 'Wrists',
	9: 'Hands',
	10: 'Finger',
	11: 'Finger',
	12: 'Trinket',
	13: 'Trinket',
	14: 'Back',
	15: 'Main hand',
	16: 'Off hand',
	17: 'Ranged',
	18: 'Tabard'
};

export function slotLabel(slot: number): string {
	return SLOT_LABELS[slot] ?? `Slot ${slot}`;
}

/** `characters.gender`, which is 0 or 1 for a player character. */
export function formatGender(gender: number): string {
	if (gender === 0) {
		return 'Male';
	}

	if (gender === 1) {
		return 'Female';
	}

	return 'Unknown';
}

/**
 * A unix timestamp, as `characters.logout_time`, to `2026-09-16 17:04 UTC`.
 *
 * Formatted in UTC and without locale formatting on purpose: the server renders
 * this and the browser hydrates it, so anything locale- or timezone-dependent
 * would render twice with different results and Svelte would complain about a
 * hydration mismatch. `0` means the value was never written — a character that
 * has not logged out yet.
 */
export function formatTimestamp(seconds: number): string {
	if (!seconds || seconds <= 0) {
		return 'never';
	}

	return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Where the item icons are served from when nothing else is configured.
 *
 * The extracted textures live in `static/interface/Icons` and are served by this
 * app, under the site root.
 */
export const DEFAULT_ICON_BASE = '/interface/Icons';

/**
 * The configured icon base, or the default when the configured one could not
 * possibly work.
 *
 * A browser can only fetch a root-relative path or an absolute URL, so anything
 * else — a filesystem path like `G:/icons`, a bare segment like `interface/Icons`
 * that would resolve against whatever page asked for it, or a Vite dev-server
 * URL like `/@fs/G:/…/static/interface/Icons` — is refused **here** rather than
 * being passed through.
 *
 * It is refused loudly for a reason: a bad base does not fail loudly by itself.
 * Every icon 403s, the image fallback turns each one into the same placeholder,
 * and the page just looks like icons "don't work". The caller logs the ignored
 * value so the real cause is visible.
 */
export function usableIconBase(configured: string | null | undefined): string {
	const value = configured?.trim() ?? '';

	if (!value) {
		return DEFAULT_ICON_BASE;
	}

	// Root-relative, but not a Vite `/@fs/` path: that is a dev-server-internal
	// filesystem URL, not something a browser should ever be pointed at.
	if (value.startsWith('/') && !value.startsWith('/@fs/')) {
		return value;
	}

	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	return DEFAULT_ICON_BASE;
}

/**
 * An icon name, as `itemdisplayinfo_dbc.InventoryIcon_1`, to an image URL.
 *
 * The name is used **verbatim**, and that is the whole trick: the client's own
 * DBC is inconsistently cased (`INV_Sword_106` sits beside `INV_SWORD_107`), and
 * the extracted textures are written out under exactly the name the DBC carries.
 * Lowercasing the name — the obvious tidy-up — breaks most icons on a
 * case-sensitive filesystem, which is what the container runs on. The extension
 * is `.png` because that is how those textures were extracted.
 *
 * `base` is where the files are served from: this app's own static directory, so
 * a player's browser fetches icons from this site rather than from a third party.
 * It is passed in rather than imported, and the default is a plain root-relative
 * path rather than a `$app/paths` helper: the textures are ignored by git *and* by
 * the Docker build context (see `.dockerignore`), so they must never become a
 * compile-time dependency of the app.
 */
export function itemIconUrl(icon: string | null, base: string): string | null {
	if (!icon) {
		return null;
	}

	return `${base.replace(/\/+$/, '')}/${icon}.png`;
}

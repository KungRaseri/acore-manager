import { eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { PLAYER_ACCESS, SEC_PLAYER, tierAtLeast, tierForLevel, type Access } from '$lib/access';
import { readAccountLevels } from '$lib/server/acore/access';
import {
	readOwnedAccount,
	type AccountOwner,
	type OwnedAccount
} from '$lib/server/accounts/ownership';
import { getDb } from '$lib/server/db';
import { gameAccount } from '$lib/server/db/schema';
import type { CurrentUser } from '$lib/user';

/**
 * Authorization.
 *
 * The single place that answers "may this user do this?". Layouts call the
 * `require*` helpers, so when the rule changes it changes here and every gated
 * route follows. Nothing else in the app should be inventing access checks.
 *
 * ## The rule
 *
 * A visitor's access is the GM level on the AzerothCore game accounts linked to
 * their profile, read from `acore_auth` through `$lib/server/acore/access`:
 *
 *   SELECT MAX(aa.gmlevel)
 *   FROM account a LEFT JOIN account_access aa ON aa.id = a.id
 *   WHERE a.username IN (…)
 *
 * [`tierForLevel`](src/lib/access.ts) maps that number onto the site's ladder,
 * and the `require*` helpers compare the tier. The effective level is the
 * highest across the profile's linked accounts, so a second, more privileged
 * account is never a downgrade.
 *
 * `SEC_ADMINISTRATOR` (gmlevel 3) is the level the worldserver's own SOAP
 * console demands, which is why it is the tier that unlocks everything which can
 * act on the server. A profile with no linked game account has no level and is
 * a player: linking is done on the accounts page, and it is the prerequisite for
 * every staff page.
 *
 * ## Where the checks belong
 *
 * A route's group or folder layout calls the `require*` helpers, and a page does
 * not re-check — the layout has already refused anyone below its floor.
 *
 * **Actions are the exception and must check for themselves.** SvelteKit runs an
 * action *before* the page's load functions, so a layout's 403 arrives only after
 * the action has already run its side effects. Every action that does anything a
 * plain player may not has to call a `require*` helper itself.
 *
 * ## Nothing is cached
 *
 * `getAccess` memoises **within one request** and nowhere else. Nothing is put on
 * the session, in a module-level map, or in a column of `game_account`, so a
 * level changed in the database applies to the very next request and there is no
 * stale state to reason about. The cost is two indexed queries per signed-in
 * request, which is the deliberate price of that property.
 *
 * ## Failing closed
 *
 * A level this site cannot read is a level it must not assume. If AzerothCore is
 * unreachable or `ACORE_DATABASE_URL` is unset, the visitor is treated as a
 * player and the failure is logged — never the other way around.
 */

/**
 * The level and tier of one profile, resolved from both databases.
 *
 * Prefer [`getAccess`](#getAccess), which memoises this per request.
 */
export async function resolveAccess(userId: string): Promise<Access> {
	try {
		const linked = await getDb()
			.select({ username: gameAccount.username })
			.from(gameAccount)
			.where(eq(gameAccount.userId, userId));

		if (linked.length === 0) {
			// No linked game account means no GM level exists to read, so
			// AzerothCore is not queried at all.
			return PLAYER_ACCESS;
		}

		const levels = await readAccountLevels(linked.map((account) => account.username));
		const level = [...levels.values()].reduce(
			(highest, current) => Math.max(highest, current),
			SEC_PLAYER
		);

		return { tier: tierForLevel(level), level };
	} catch (cause) {
		/*
			A broken link to AzerothCore must not 500 every page in the app, and it
			must not grant access it could not verify — so it is logged and the
			visitor is a player. Failing open is rejected on purpose.
		*/
		console.error(
			'[authz] could not read AzerothCore GM levels; treating this user as a player',
			cause
		);

		return PLAYER_ACCESS;
	}
}

/**
 * Request-scoped memoisation of [`resolveAccess`](#resolveAccess).
 *
 * Keyed by the request's own `locals` object, which SvelteKit creates per
 * request and discards afterwards — so the entry dies with the request and this
 * is **not** a cache. A layout load, a page load and an action all ask, and all
 * share one lookup.
 *
 * Do not replace this with a module-level map or a TTL: a GM level that lags
 * behind the database is exactly the state this design refuses to have.
 */
const accessByLocals = new WeakMap<App.Locals, Promise<Access>>();

export function getAccess(locals: App.Locals): Promise<Access> {
	const userId = locals.user?.id;

	if (!userId) {
		return Promise.resolve(PLAYER_ACCESS);
	}

	const pending = accessByLocals.get(locals);

	if (pending) {
		return pending;
	}

	// Stored before it settles, so concurrent callers in the same request await
	// the same lookup instead of duplicating it.
	const resolving = resolveAccess(userId);

	accessByLocals.set(locals, resolving);

	return resolving;
}

/** Whether the profile may act on the server at all: the highest tier. */
export function isServerManager(access: Access): boolean {
	return tierAtLeast(access.tier, 'administrator');
}

/**
 * Returns the signed-in user, or redirects to the sign-in page.
 *
 * `redirectTo` is carried through the sign-in flow so the visitor lands back on
 * the page they asked for rather than the default landing route.
 */
export function requireUser(user: CurrentUser | null, redirectTo: string): CurrentUser {
	if (!user) {
		redirect(302, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}

	return user;
}

/** Refuses a signed-in visitor the staff area is not open to. */
export function requireStaff(access: Access): void {
	if (!tierAtLeast(access.tier, 'moderator')) {
		error(403, 'The staff area is not open to this account.');
	}
}

/** Refuses a staff member whose linked game account is below game master. */
export function requireGameMaster(access: Access): void {
	if (!tierAtLeast(access.tier, 'game-master')) {
		error(403, 'This page needs a game master level on a linked game account.');
	}
}

/** Refuses a signed-in user the server-management pages are not open to. */
export function requireServerManager(access: Access): void {
	if (!isServerManager(access)) {
		error(403, 'Your account is not allowed to manage this server.');
	}
}

/**
 * The game account named by `username`, if it is on this realm **and** belongs to
 * this profile.
 *
 * ## A per-resource rule, not a tier
 *
 * The `require*` helpers above answer "what tier is this user?" once for a whole
 * area. This one answers "is this particular thing theirs?", per request, for the
 * account whose page is being opened — the tiers say nothing about it. It sits
 * here because authorization has one home, and because every account-scoped route
 * **and action** has to call it: an action is not covered by a layout (see above),
 * and a page that forgot this check would serve any account whose name a visitor
 * could guess.
 *
 * The decision itself is [`isOwnedByProfile`](src/lib/server/accounts/ownership.ts):
 * a `game_account` link, or the account carrying the visitor's Discord address.
 *
 * ## 404, deliberately
 *
 * An account that does not exist and an account that belongs to somebody else get
 * the same answer, so this cannot be used to work out which names are taken — the
 * same reasoning the link form uses when it refuses to say whether a name exists.
 */
export async function requireOwnedAccount(
	owner: AccountOwner,
	username: string
): Promise<OwnedAccount> {
	const account = await readOwnedAccount(owner, username);

	if (!account) {
		error(404, 'That game account is not on this realm, or it is not linked to your profile.');
	}

	return account;
}

/**
 * Constrains a `redirectTo` value to a same-site path.
 *
 * Only a leading-slash path is accepted. `//evil.example` is a protocol-relative
 * URL that browsers follow off-site and an absolute URL is worse, so anything
 * else falls back to the caller's default. This is the classic open-redirect
 * guard, and it belongs next to the redirect it protects.
 */
export function safeRedirectTarget(value: string | null, fallback = '/dashboard'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return fallback;
	}

	return value;
}

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { validateUsername } from '$lib/server/accounts/rules';
import { requireOwnedAccount, requireUser } from '$lib/server/authz';
import { readAreas, readClasses, readRaces } from '$lib/server/characters/reference';
import { listCharacters, listDeletedCharacters } from '$lib/server/characters/service';
import { toCurrentUser } from '$lib/user';

/**
 * One game account, and the characters on it.
 *
 * ## The username in the URL is a claim, not a permission
 *
 * The route takes the account's *name*, because that is the only key an account
 * has that works for both the linked and the email-matched kind — a
 * `game_account` row exists for the first and not the second. Nothing is served
 * on the strength of the name alone: `requireOwnedAccount` proves it belongs to
 * this profile and answers 404 when it does not, so guessing names gets a visitor
 * nothing.
 *
 * The name is normalised with the same validator the create and link forms use,
 * so any capitalisation finds the account and anything malformed is refused
 * before a query runs.
 */
export const load = (async ({ locals, params, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
	const username = validateUsername(params.username);

	if (!username.ok) {
		error(404, 'No such game account on this realm.');
	}

	const account = await requireOwnedAccount({ userId: user.id, email: user.email }, username.value);

	// The characters are ours; the deleted ones are read from the same table but a
	// different account column, and are shown because a player cannot see them in
	// game — they are restorable, not gone.
	const [characters, deleted] = await Promise.all([
		listCharacters(account.id),
		listDeletedCharacters(account.id)
	]);

	// Names for the ids the rows carry. Classes and races are read whole (a couple
	// of dozen rows), areas only for the zones actually in play.
	const [classes, races, areas] = await Promise.all([
		readClasses(),
		readRaces(),
		readAreas(characters.flatMap((character) => [character.zoneId, character.mapId]))
	]);

	return {
		account: { username: account.username, email: account.email },
		characters: characters.map((character) => {
			const race = races.get(character.race);

			return {
				...character,
				className: classes.get(character.class) ?? `Class ${character.class}`,
				raceName: race?.name ?? `Race ${character.race}`,
				alliance: race?.alliance ?? null,
				// The zone the character stands in, falling back to the map it is on
				// when the zone is unknown — which is what the client shows too.
				zoneName: areas.get(character.zoneId) ?? areas.get(character.mapId) ?? null
			};
		}),
		deleted: deleted.map((character) => ({
			...character,
			className: classes.get(character.class) ?? `Class ${character.class}`,
			raceName: races.get(character.race)?.name ?? `Race ${character.race}`
		})),
		totals: {
			count: characters.length,
			highestLevel: characters.reduce((highest, row) => Math.max(highest, row.level), 0),
			totalTime: characters.reduce((total, row) => total + row.totalTime, 0),
			money: characters.reduce((total, row) => total + row.money, 0),
			online: characters.filter((row) => row.online).length
		}
	};
}) satisfies PageServerLoad;

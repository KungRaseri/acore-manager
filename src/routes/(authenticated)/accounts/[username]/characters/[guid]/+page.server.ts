import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { validateUsername } from '$lib/server/accounts/rules';
import { requireOwnedAccount, requireUser } from '$lib/server/authz';
import {
	readAreas,
	readClasses,
	readItems,
	readRaces,
	readSkills
} from '$lib/server/characters/reference';
import { findCharacter, listEquippedItems, listSkills } from '$lib/server/characters/service';
import { toCurrentUser } from '$lib/user';

/** One message for "no such character" and "not on this account", on purpose. */
const NOT_FOUND = 'No such character on this account.';

/**
 * One character: who it is, what it is wearing, and what it has trained.
 *
 * ## Two claims in the URL, both checked
 *
 * The account's name and the character's guid both arrive from the URL, and
 * neither is trusted. The name is proved to be this profile's by
 * `requireOwnedAccount`; the guid is then looked up **scoped to that account**
 * (`findCharacter`), so a character that exists but sits on somebody else's
 * account is simply not found. Guids are small integers — without that second
 * step, counting upwards would be enough to read any character on the realm.
 */
export const load = (async ({ locals, params, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
	const username = validateUsername(params.username);

	if (!username.ok) {
		error(404, 'No such game account on this realm.');
	}

	const account = await requireOwnedAccount({ userId: user.id, email: user.email }, username.value);

	// A non-numeric guid never reaches a query: `Number('abc')` is `NaN`, and a
	// guid of 0 or less is not a character even if the driver would accept it.
	const guid = Number(params.guid);

	if (!Number.isInteger(guid) || guid <= 0) {
		error(404, NOT_FOUND);
	}

	const character = await findCharacter(account.id, guid);

	if (!character) {
		error(404, NOT_FOUND);
	}

	// The character is ours, so its own ids are safe to read with. Gear and skills
	// are two index reads; the rest are names for the ids those rows carry.
	const [equipped, skills] = await Promise.all([
		listEquippedItems(character.guid),
		listSkills(character.guid)
	]);

	const [classes, races, areas, items, skillNames] = await Promise.all([
		readClasses(),
		readRaces(),
		readAreas([character.zoneId, character.mapId]),
		readItems(equipped.map((item) => item.entry)),
		readSkills(skills.map((skill) => skill.skill))
	]);

	const race = races.get(character.race);

	return {
		account: { username: account.username },
		character: {
			...character,
			className: classes.get(character.class) ?? `Class ${character.class}`,
			raceName: race?.name ?? `Race ${character.race}`,
			alliance: race?.alliance ?? null,
			zoneName: areas.get(character.zoneId) ?? areas.get(character.mapId) ?? null
		},
		equipped: equipped.map((item) => {
			const summary = items.get(item.entry);
			/*
				An entry the world database does not define is shown as unknown rather
				than dropped: an orphaned item is a real state on a live realm, and
				hiding it would leave a hole in the equipment list that looks like a
				rendering bug.
			*/
			const result = {
				slot: item.slot,
				count: item.count,
				name: summary?.name ?? `Unknown item #${item.entry}`,
				quality: summary?.quality ?? 1,
				itemLevel: summary?.itemLevel ?? null,
				iconUrl: summary?.iconUrl ?? null
			};

			return result;
		}),
		skills: skills.map((skill) => ({
			...skill,
			name: skillNames.get(skill.skill) ?? `Skill ${skill.skill}`
		}))
	};
}) satisfies PageServerLoad;

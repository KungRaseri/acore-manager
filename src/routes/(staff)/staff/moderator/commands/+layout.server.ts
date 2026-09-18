import type { LayoutServerLoad } from './$types';
import { getAccess, requireStaff } from '$lib/server/authz';

/**
 * Floor: `moderator` — gmlevel 1 and up.
 *
 * The folder name is the floor, and this folder is where the *softest* audience
 * of a command browser sits: most of the commands a moderator is trusted with are
 * level 1, and the level-2 tools are the point of the page, so a higher floor
 * would hide the browser behind a tier that mostly does not need it.
 *
 * What a visitor may *run* is deliberately not decided here. It is decided per
 * command, from the realm's own security number, in this folder's action — a
 * command above the visitor's level is still listed, so that "needs gmlevel 3" can
 * be explained rather than hidden, and the folder floor says only who may open the
 * browser.
 *
 * `$lib/server/staff-routes.spec.ts` checks that every folder with a page states
 * its own floor instead of inheriting the group's silently.
 */
export const load = (async ({ locals }) => {
	requireStaff(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

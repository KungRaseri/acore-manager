import type { LayoutServerLoad } from './$types';
import { getAccess, requireServerManager } from '$lib/server/authz';

/**
 * Floor: `administrator` — gmlevel 3 and up, the floor this folder's name implies
 * and the same one the `admin` folder above it declares.
 *
 * The trail is a forensic record *across* staff: a row carries the actor, the
 * command, the arguments and the console's own reply, which together name
 * accounts, players and reasons. A moderator already sees the outcome of their
 * own attempt next to the command that produced it; the page that aggregates
 * everybody's attempts is a tier-3 tool. It is stated here, on the route, rather
 * than on the link that reaches it, because the folder's inherited floor is the
 * softest one in the staff area.
 *
 * It is declared on this folder's own layout rather than inherited from `admin`,
 * because `$lib/server/staff-routes.spec.ts` requires every folder holding a page
 * to state its floor itself. That check is a *substring* search over this file, so
 * exactly one helper may be named in it — comments included.
 */
export const load = (async ({ locals }) => {
	requireServerManager(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

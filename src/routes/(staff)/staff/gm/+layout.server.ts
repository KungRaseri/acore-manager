import type { LayoutServerLoad } from './$types';
import { getAccess, requireGameMaster } from '$lib/server/authz';

/**
 * Floor: `game-master` — gmlevel 2 and up.
 *
 * What lives here is read-only, but it reaches the worldserver through the
 * site's SOAP credential and reports on the inside of the realm, so a moderator
 * is one step short. The floor is stated here, next to the pages it covers, and
 * `$lib/server/staff-routes.spec.ts` checks that it is declared at all.
 */
export const load = (async ({ locals }) => {
	requireGameMaster(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

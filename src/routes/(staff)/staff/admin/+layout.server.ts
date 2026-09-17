import type { LayoutServerLoad } from './$types';
import { getAccess, requireServerManager } from '$lib/server/authz';

/**
 * Floor: `administrator` — gmlevel 3 and up, the highest in the staff area.
 *
 * `SEC_ADMINISTRATOR` is the level the worldserver's own SOAP console demands,
 * so it is the level at which this site is willing to act on the server rather
 * than only read from it. Stated here, next to the pages it covers; see
 * `$lib/server/staff-routes.spec.ts`.
 */
export const load = (async ({ locals }) => {
	requireServerManager(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

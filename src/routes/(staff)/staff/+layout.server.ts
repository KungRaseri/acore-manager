import type { LayoutServerLoad } from './$types';
import { getAccess, requireStaff } from '$lib/server/authz';

/**
 * Floor: `moderator` — gmlevel 1 and up, the same as the group that contains it.
 *
 * Declared here so the contract holds without exception: **every folder that
 * contains a page declares its own floor**, stated next to the pages it covers,
 * and `$lib/server/staff-routes.spec.ts` checks it. Repeating the group's rule is
 * the price of having no folder whose floor has to be inferred from its parent.
 */
export const load = (async ({ locals }) => {
	requireStaff(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

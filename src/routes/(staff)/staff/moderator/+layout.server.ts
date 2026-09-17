import type { LayoutServerLoad } from './$types';
import { getAccess, requireStaff } from '$lib/server/authz';

/**
 * Floor: `moderator` — gmlevel 1 and up.
 *
 * The group layout above already enforces this one, and declaring it again is
 * the point of the folder-name contract rather than duplication for its own
 * sake: the rule is stated where a reader looks for it, and
 * `$lib/server/staff-routes.spec.ts` checks that every folder under `/staff`
 * declares its own floor instead of inheriting one silently.
 */
export const load = (async ({ locals }) => {
	requireStaff(await getAccess(locals));

	return {};
}) satisfies LayoutServerLoad;

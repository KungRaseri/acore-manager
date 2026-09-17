import type { LayoutServerLoad } from './$types';
import { getAccess, requireUser } from '$lib/server/authz';
import { toCurrentUser } from '$lib/user';

/**
 * Everything under `(authenticated)` needs a session, so the check lives on the
 * group layout rather than on each page.
 *
 * `access` is computed here because the rule lives in server-only code and the
 * shell cannot import `$lib/server`. The shell then filters the static `staffNav`
 * with the tier it was given — and that is cosmetic, not authorization: every
 * route an item points at is guarded by the layout that owns it, so a link the
 * nav happens to show is a 403 rather than a hole. The tier is what crosses,
 * not the nav, because a `NavItem` carries an icon component and load data has to
 * be serializable.
 *
 * Reading the access level here costs two indexed queries per signed-in request.
 * That is the deliberate price of resolving it live rather than caching it: see
 * the "Nothing is cached" note in `$lib/server/authz`.
 */
export const load = (async ({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
	const access = await getAccess(locals);

	return {
		user,
		access
	};
}) satisfies LayoutServerLoad;

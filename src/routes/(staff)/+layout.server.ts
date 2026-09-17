import type { LayoutServerLoad } from './$types';
import { getAccess, requireStaff, requireUser } from '$lib/server/authz';
import { toCurrentUser } from '$lib/user';

/**
 * The staff area: signed in *and* staff.
 *
 * Two separate checks on purpose. `requireUser` sends an anonymous visitor to
 * the sign-in page; `requireStaff` answers a signed-in visitor who is not staff
 * with a 403 instead of a login loop. The rule itself is in `$lib/server/authz`.
 *
 * This is the **weakest** rule in the tree, deliberately. Every folder beneath it
 * declares its own, stricter floor on its own layout, so a parent never refuses a
 * page its child would have allowed — and the folder name states that floor, so
 * `/staff/gm` reads as "game master and up" without opening a file.
 *
 * `$lib/server/staff-routes.spec.ts` fails the build when a folder under `/staff`
 * forgets to declare one; without it, a new folder would inherit this floor
 * silently.
 */
export const load = (async ({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
	const access = await getAccess(locals);

	requireStaff(access);

	/*
		`access` crosses to the browser; the nav does not. Load data is serialised
		as JSON, and a `NavItem` carries an icon component, which cannot be
		stringified. The tier is a plain string, and the shell filters the static
		nav arrays with it — which is cosmetic, not authorization: whatever the nav
		shows, the route an item points at is guarded by the layout that owns it.
	*/
	return {
		user,
		access
	};
}) satisfies LayoutServerLoad;

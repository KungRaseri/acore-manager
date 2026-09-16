import type { LayoutServerLoad } from './$types';
import { isServerManager, requireUser } from '$lib/server/authz';
import { toCurrentUser } from '$lib/user';

/**
 * Everything under `(authenticated)` needs a session, so the check lives on the
 * group layout rather than on each page.
 *
 * `showAdminNav` is computed here because the rule lives in server-only code
 * (`$lib/server` cannot be imported by a component). The shell renders what it
 * is told instead of deciding for itself.
 */
export const load = (({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);

	return {
		user,
		showAdminNav: isServerManager(user)
	};
}) satisfies LayoutServerLoad;

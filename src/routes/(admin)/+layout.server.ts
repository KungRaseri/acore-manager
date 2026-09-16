import type { LayoutServerLoad } from './$types';
import { requireServerManager, requireUser } from '$lib/server/authz';
import { toCurrentUser } from '$lib/user';

/**
 * The management area: signed in *and* permitted.
 *
 * Two separate checks on purpose. `requireUser` sends an anonymous visitor to
 * the sign-in page; `requireServerManager` answers a signed-in visitor who is
 * not permitted with a 403 instead of a login loop. The permission rule itself
 * is documented in `$lib/server/authz`.
 */
export const load = (({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);

	requireServerManager(user);

	return { user };
}) satisfies LayoutServerLoad;

import type { LayoutServerLoad } from './$types';
import { toCurrentUser } from '$lib/user';

/**
 * Publishes the signed-in user to the whole app.
 *
 * `hooks.server.ts` puts the Better Auth session on `event.locals`; this narrows
 * it to the fields the UI may see (see `$lib/user`) before it becomes page data
 * that any component can read.
 *
 * Group layouts narrow this further where a signed-in user is required —
 * `(authenticated)` and `(admin)` both redirect when `user` is null.
 */
export const load = (({ locals }) => ({
	user: locals.user ? toCurrentUser(locals.user) : null
})) satisfies LayoutServerLoad;

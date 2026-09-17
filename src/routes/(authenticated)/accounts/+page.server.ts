import type { Actions, PageServerLoad } from './$types';
import {
	createGameAccount,
	linkExistingGameAccount,
	listPlayerAccounts,
	unlinkGameAccount,
	type AccountResult
} from '$lib/server/accounts/service';
import { requireUser } from '$lib/server/authz';
import { toCurrentUser } from '$lib/user';

/**
 * Every action returns this same shape, whatever the outcome.
 *
 * A uniform result keeps the page's `form` a single object instead of a union
 * the template would have to narrow, and it means the page never has to care
 * which action produced a message — only whether it was a success.
 */
interface ActionState {
	action: 'create' | 'link' | 'unlink';
	result: AccountResult;
}

function toState(action: ActionState['action'], result: AccountResult): ActionState {
	return { action, result };
}

/*
	The actions below call `requireUser` and nothing more, and that is deliberate
	rather than an oversight. Each one works strictly on the caller's own
	`user.id`: the account it creates, claims or unlinks is by definition theirs,
	so there is no elevation to grant and no other profile's data to protect.

	An action that ever touches somebody else's accounts needs its own `require*`
	check, because a layout does not guard actions — SvelteKit runs them before
	the page's load functions. See `$lib/server/authz`.
*/

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);

	// The list comes from the realm, not from our own table: these are the
	// accounts this Discord address owns, annotated with whether this profile has
	// recorded the claim yet.
	return {
		accounts: await listPlayerAccounts(user.id, user.email)
	};
};

export const actions = {
	create: async ({ locals, request, url }) => {
		const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
		const data = await request.formData();

		// The account email is the signed-in identity's address, not a form
		// field: it is what ties the game account to the Discord profile.
		const result = await createGameAccount(
			user.id,
			String(data.get('username') ?? ''),
			String(data.get('password') ?? ''),
			user.email
		);

		return toState('create', result);
	},

	link: async ({ locals, request, url }) => {
		const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
		const data = await request.formData();

		// The password is optional here on purpose: it is only needed when the
		// account's stored email is not the visitor's Discord address.
		const result = await linkExistingGameAccount(
			user.id,
			String(data.get('username') ?? ''),
			String(data.get('password') ?? ''),
			user.email
		);

		return toState('link', result);
	},

	unlink: async ({ locals, request, url }) => {
		const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
		const data = await request.formData();

		const result = await unlinkGameAccount(user.id, String(data.get('accountId') ?? ''));

		return toState('unlink', result);
	}
} satisfies Actions;

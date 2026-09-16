import type { Actions, PageServerLoad } from './$types';
import {
	createGameAccount,
	linkExistingGameAccount,
	listGameAccounts,
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
	const accounts = await listGameAccounts(user.id);

	return {
		accounts: accounts.map((account) => ({
			id: account.id,
			username: account.username,
			// Formatted here, not in the template: a locale-dependent format
			// would render differently on the server and in the browser and
			// trip hydration.
			linkedOn: account.createdAt.toISOString().slice(0, 10)
		}))
	};
};

export const actions = {
	create: async ({ locals, request, url }) => {
		const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
		const data = await request.formData();

		const result = await createGameAccount(
			user.id,
			String(data.get('username') ?? ''),
			String(data.get('password') ?? '')
		);

		return toState('create', result);
	},

	link: async ({ locals, request, url }) => {
		const user = requireUser(locals.user ? toCurrentUser(locals.user) : null, url.pathname);
		const data = await request.formData();

		const result = await linkExistingGameAccount(
			user.id,
			String(data.get('username') ?? ''),
			String(data.get('password') ?? '')
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

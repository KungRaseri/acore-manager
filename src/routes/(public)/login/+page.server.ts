import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { safeRedirectTarget } from '$lib/server/authz';

export const load: PageServerLoad = ({ locals, url }) => {
	// Already signed in — send them where they were headed.
	if (locals.user) {
		redirect(302, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const auth = getAuth();

		// Validated, not trusted: the value arrives from the query string, so it
		// could be an off-site URL. It is also handed to Better Auth as the
		// post-OAuth destination, which is exactly where an open redirect would
		// be most effective.
		const callbackURL = safeRedirectTarget(event.url.searchParams.get('redirectTo'));

		// Better Auth returns the provider's authorization URL; we forward the
		// browser to it. The OAuth state cookie is written through the
		// sveltekitCookies plugin, so it lands on this response.
		const result = await auth.api.signInSocial({
			body: {
				provider: 'discord',
				callbackURL
			},
			headers: event.request.headers
		});

		if (!result?.url) {
			return { error: 'Could not start the Discord sign-in flow. Check the Discord settings.' };
		}

		redirect(303, result.url);
	}
};

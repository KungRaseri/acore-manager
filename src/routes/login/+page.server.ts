import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';

export const load: PageServerLoad = (event) => {
	// Already signed in — nothing to do here.
	if (event.locals.user) {
		return redirect(302, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const auth = getAuth();

		// Better Auth returns the provider's authorization URL; we forward the
		// browser to it. The OAuth state cookie is written through the
		// sveltekitCookies plugin, so it lands on this response.
		const result = await auth.api.signInSocial({
			body: {
				provider: 'discord',
				callbackURL: '/'
			},
			headers: event.request.headers
		});

		if (!result?.url) {
			return { error: 'Could not start the Discord sign-in flow. Check the Discord settings.' };
		}

		return redirect(303, result.url);
	}
};

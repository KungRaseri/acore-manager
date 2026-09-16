import type { Actions, PageServerLoad } from './$types';
import { getServerInfo, isSoapConfigured } from '$lib/server/acore';

/**
 * One result shape for every outcome so the page never has to narrow a union.
 * `ok: false` covers both "not configured" and a SOAP failure — the page shows
 * `message` either way.
 */
export interface CheckResult {
	ok: boolean;
	message: string;
	output: string;
}

/**
 * The load stays cheap: it reports configuration, not connectivity.
 *
 * A live check would block the page render on the worldserver, and a SOAP call
 * against a stopped server is a 10-second timeout by design (see the SOAP
 * client). Connectivity is therefore something the user asks for, below.
 */
export const load = (() => ({
	soapConfigured: isSoapConfigured()
})) satisfies PageServerLoad;

export const actions = {
	check: async () => {
		if (!isSoapConfigured()) {
			return {
				check: {
					ok: false,
					message:
						'ACORE_SOAP_URL, ACORE_SOAP_USER and ACORE_SOAP_PASSWORD must all be set to reach the console.',
					output: ''
				} satisfies CheckResult
			};
		}

		const result = await getServerInfo();

		return {
			check: {
				ok: result.ok,
				message: result.ok ? '' : result.message,
				output: result.output ?? ''
			} satisfies CheckResult
		};
	}
} satisfies Actions;

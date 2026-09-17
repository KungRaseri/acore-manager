import type { PageServerLoad } from './$types';
import { SEC_PLAYER } from '$lib/access';
import { listGameAccounts } from '$lib/server/accounts/service';
import { readAccountLevels } from '$lib/server/acore/access';

/**
 * The staff dashboard's own content: which linked game accounts carry the level
 * that let the visitor in.
 *
 * The access check is the group layout's job, and this page sits directly under
 * its floor, so nothing is checked here. See `$lib/server/authz` for why a page
 * does not re-check but an action must.
 */
export const load = (async ({ parent }) => {
	const { user } = await parent();
	const linked = await listGameAccounts(user.id);
	const levels = await readAccountLevels(linked.map((account) => account.username));

	return {
		accounts: linked.map((account) => ({
			username: account.username,
			// `readAccountLevels` keys by uppercased name, matching how
			// AzerothCore stores account names and how `game_account` records
			// them, so no case folding is needed on this side.
			level: levels.get(account.username.toUpperCase()) ?? SEC_PLAYER
		}))
	};
}) satisfies PageServerLoad;

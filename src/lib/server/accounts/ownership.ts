import type { RowDataPacket } from 'mysql2';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { getAcoreAuthDb } from '$lib/server/db/acore';
import { gameAccount } from '$lib/server/db/schema';
import { emailsMatch } from './rules';

/**
 * Who owns a game account.
 *
 * This is the **one** place that answers it, and it has to stay that way: the
 * accounts page decides what to list with the same rule, so if the two ever
 * disagree the site hides a link without closing the URL behind it — the exact
 * bug this module exists to prevent.
 *
 * ## The rule
 *
 * An account belongs to a profile when either
 *
 * 1. a `game_account` row links it to that profile, or
 * 2. `account.email` is the Discord address on the profile.
 *
 * The second is what makes the accounts page work at all: an account created
 * outside this site still carries an address, and AzerothCore is the source of
 * truth for it. It is a weaker claim than an explicit link, and it is accepted
 * deliberately — a Discord account owns the address, so an account registered to
 * it is that person's by definition. One consequence is worth stating: unlinking
 * does not revoke this, because the account keeps the address. See
 * [`listPlayerAccounts`](../accounts/service.ts), which lists on the same basis.
 */

/** The profile fields ownership is decided from. */
export interface AccountOwner {
	userId: string;
	/** The Discord address, from the identity provider — never a form field. */
	email: string;
}

/** The account columns the ownership decision and the character pages need. */
export interface OwnedAccount {
	id: number;
	username: string;
	email: string;
}

interface AccountRow extends RowDataPacket {
	id: number;
	username: string;
	email: string;
}

/**
 * The decision itself, kept pure so it can be reasoned about and tested without
 * a database: `linked` is whether a `game_account` row already ties the account
 * to this profile.
 */
export function isOwnedByProfile(
	account: { email: string },
	owner: { email: string },
	linked: boolean
): boolean {
	return linked || emailsMatch(account.email, owner.email);
}

/**
 * The account `username` names, if it exists **and** belongs to this profile.
 *
 * `null` covers both "no such account" and "not yours", and the caller reports
 * them with one message on purpose — the same reasoning as the link form, which
 * refuses to say which names exist. Two indexed lookups: the account by its
 * unique name, then the link by profile.
 */
export async function readOwnedAccount(
	owner: AccountOwner,
	username: string
): Promise<OwnedAccount | null> {
	const [rows] = await getAcoreAuthDb().query<AccountRow[]>(
		// `account.username` has a case-insensitive collation, so the comparison
		// matches whatever case the URL carried.
		'SELECT id, username, email FROM account WHERE username = ? LIMIT 1',
		[username]
	);

	const account = rows[0];

	if (!account) {
		return null;
	}

	// `game_account.username` is stored uppercase, matching the server's own
	// normalisation, so the link is looked up by that form whatever case the URL
	// used.
	const linked = await getDb()
		.select({ id: gameAccount.id })
		.from(gameAccount)
		.where(
			and(
				eq(gameAccount.userId, owner.userId),
				eq(gameAccount.username, account.username.toUpperCase())
			)
		)
		.limit(1);

	if (!isOwnedByProfile(account, owner, linked.length > 0)) {
		return null;
	}

	return { id: account.id, username: account.username, email: account.email };
}

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2';
import { executeCommand } from '$lib/server/acore';
import { getDb } from '$lib/server/db';
import { getAcoreAuthDb } from '$lib/server/db/acore';
import { gameAccount } from '$lib/server/db/schema';
import {
	emailsMatch,
	validateEmail,
	validateExistingPassword,
	validateNewPassword,
	validateUsername
} from './rules';
import { verifierMatches } from './srp6';

/*
	Both columns are `NOT NULL DEFAULT ''` in AzerothCore's schema, so an address
	is either a string or empty — never null. Empty is what a pre-website account
	carries.
*/

/** The columns linking needs from AzerothCore's `account` table. */
interface AccountCredentials extends RowDataPacket {
	id: number;
	email: string;
	salt: Buffer;
	verifier: Buffer;
}

/** The columns the accounts list needs. */
interface AccountSummary extends RowDataPacket {
	username: string;
	email: string;
}

/**
 * Game account provisioning and linking.
 *
 * ## Creation goes through the worldserver
 *
 * Accounts are **not** written directly into `acore_auth`. The site runs
 * `account create <username> <password> <email>` over the worldserver's console
 * (SOAP), so the server computes the salt and SRP6 verifier itself — the same
 * code path as `.account create` typed into the console, and the same path as
 * the wiki's documented procedure. Nothing here invents its own registration
 * format, and a change to AzerothCore's registration data cannot silently
 * diverge from us.
 *
 * Every argument in that command line is checked to be a single whitespace-free
 * token first, because the server parses the command by splitting on spaces: an
 * argument containing one would quietly turn into two arguments.
 *
 * ## Linking is the legacy path, and the email decides first
 *
 * Everything created from this site carries the address of the Discord identity
 * that made it, so an account and a profile already agree on an email. Linking
 * exists for the few accounts that predate the site.
 *
 * Two things can prove such an account belongs to the visitor:
 *
 * 1. **The account's stored email is the Discord address that signed in.** That
 *    address comes from the identity provider, never from a form field, so a
 *    match is evidence the account was set up against this Discord account.
 * 2. **The account's own password**, checked against the salt and verifier on
 *    the `acore_auth.account` row — the identical check the auth server makes at
 *    logon (see `srp6.ts`). This is the fallback for accounts whose email is
 *    empty or belongs to something else.
 *
 * Neither path changes the password. The one write into `acore_auth` happens
 * *after* the link is recorded: the account's email is set to the Discord
 * address, so from then on the two agree and the account is reachable through
 * the profile that owns it.
 *
 * ## No transactions across databases
 *
 * MySQL cannot commit across `acore_manager` and `acore_auth`, so a failure
 * between the two steps leaves an account that exists but is not linked. That
 * state is recoverable on purpose: the account is a normal game account, and
 * the visitor can attach it themselves with "link an existing account". Every
 * step below is therefore written to be safe to repeat.
 */

export interface LinkedGameAccount {
	id: string;
	username: string;
	createdAt: Date;
}

export type AccountResult = { ok: true; message: string } | { ok: false; message: string };

/** MySQL's duplicate-key error. */
function isDuplicateEntry(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

export async function listGameAccounts(userId: string): Promise<LinkedGameAccount[]> {
	return getDb()
		.select({
			id: gameAccount.id,
			username: gameAccount.username,
			createdAt: gameAccount.createdAt
		})
		.from(gameAccount)
		.where(eq(gameAccount.userId, userId))
		.orderBy(gameAccount.username);
}

/**
 * An account on the realm that belongs to this player, and whether this profile
 * records the link.
 */
export interface PlayerGameAccount {
	username: string;
	/** The address on the game account itself; empty when it has none. */
	email: string;
	/** Whether a `game_account` row links it to this profile. */
	linked: boolean;
	/** That row's id when linked — what unlinking needs. */
	linkId: string | null;
}

/**
 * The player's accounts on the realm.
 *
 * Two sources, because neither one alone is the whole truth:
 *
 * 1. **The address on the account.** This is the primary source: accounts created
 *    here carry the Discord address, and a legacy account is claimed by matching
 *    it. It is also why unlinking does not remove a row from this list — the
 *    account is still the player's, the mapping only records the claim.
 * 2. **Anything already linked**, including accounts linked through the password
 *    fallback, whose address is somebody else's or empty. Without this they would
 *    disappear from the page at the moment they were linked.
 *
 * `account.email` carries no index in AzerothCore's schema, so this is a table
 * scan. That is fine for the account counts of a private realm and would want an
 * index before it ran on a very large one — but adding one means a DDL change on
 * a database this project does not own.
 */
export async function listPlayerAccounts(
	userId: string,
	email: string
): Promise<PlayerGameAccount[]> {
	const linked = await listGameAccounts(userId);
	const linkIdByUsername = new Map(linked.map((account) => [account.username, account.id]));
	const accounts = new Map<string, PlayerGameAccount>();

	const [byEmail] = await getAcoreAuthDb().query<AccountSummary[]>(
		'SELECT username, email FROM account WHERE email = ? ORDER BY username',
		[email]
	);

	for (const row of byEmail) {
		accounts.set(row.username, {
			username: row.username,
			email: row.email,
			linked: linkIdByUsername.has(row.username),
			linkId: linkIdByUsername.get(row.username) ?? null
		});
	}

	// Linked accounts the address did not surface still need their real address
	// shown, so the page does not claim they have none. Bounded by how many
	// accounts one profile has linked.
	const unlisted = [...linkIdByUsername.keys()].filter((username) => !accounts.has(username));

	if (unlisted.length > 0) {
		const [rows] = await getAcoreAuthDb().query<AccountSummary[]>(
			`SELECT username, email FROM account WHERE username IN (${unlisted.map(() => '?').join(', ')})`,
			unlisted
		);

		for (const row of rows) {
			accounts.set(row.username, {
				username: row.username,
				email: row.email,
				linked: true,
				linkId: linkIdByUsername.get(row.username) ?? null
			});
		}
	}

	return [...accounts.values()].sort((a, b) => a.username.localeCompare(b.username));
}

/** Runs one console command and reduces a failure to something printable. */
async function runConsoleCommand(command: string): Promise<AccountResult> {
	const result = await executeCommand(command, { timeoutMs: 20_000 });

	if (result.ok) {
		return { ok: true, message: result.output };
	}

	// The console's own wording is the most useful thing we can show: it comes
	// from the server, and it distinguishes "already exists" from "too long"
	// from "SQL error". Only the transport failures need our own words.
	switch (result.reason) {
		case 'not-configured':
		case 'unreachable':
		case 'timeout':
			return {
				ok: false,
				message:
					'The game server did not answer, so no account was created. Please try again shortly.'
			};
		case 'unauthorized':
		case 'forbidden':
			return {
				ok: false,
				message:
					'This site is not permitted to create game accounts right now, so nothing was created. An administrator has to fix the console credentials.'
			};
		default:
			return { ok: false, message: result.message || 'The game server refused the command.' };
	}
}

/**
 * Creates a game account on the worldserver and records it against the user.
 *
 * `rawEmail` is the address on the signed-in Discord identity, not a
 * visitor-entered field: every account this site creates carries the address of
 * the profile it belongs to, which is what makes the email check work later.
 *
 * On failure after the account exists, the message says so — the visitor needs
 * to know they can log in with the credentials they just chose even though this
 * page does not show the account yet.
 */
export async function createGameAccount(
	userId: string,
	rawUsername: string,
	rawPassword: string,
	rawEmail: string
): Promise<AccountResult> {
	const username = validateUsername(rawUsername);
	if (!username.ok) {
		return username;
	}

	const password = validateNewPassword(rawPassword);
	if (!password.ok) {
		return password;
	}

	const email = validateEmail(rawEmail);
	if (!email.ok) {
		return email;
	}

	const existing = await getDb()
		.select({ id: gameAccount.id })
		.from(gameAccount)
		.where(eq(gameAccount.username, username.value))
		.limit(1);

	if (existing.length > 0) {
		return {
			ok: false,
			message: 'That account name is already linked to a profile on this site.'
		};
	}

	const created = await runConsoleCommand(
		`account create ${username.value} ${password.value} ${email.value}`
	);

	if (!created.ok) {
		return created;
	}

	try {
		await getDb().insert(gameAccount).values({
			id: randomUUID(),
			userId,
			username: username.value
		});
	} catch (error) {
		if (isDuplicateEntry(error)) {
			return {
				ok: false,
				message: 'That account name is already linked to a profile on this site.'
			};
		}

		// The account now exists on the realm but is not linked here. Saying so
		// is the honest outcome, and the link form is the way to fix it.
		return {
			ok: false,
			message: `The account "${username.value}" was created on the server, but could not be linked to this profile. Use "Link an existing account" to attach it.`
		};
	}

	return {
		ok: true,
		message: `Account "${username.value}" is ready. You can log into the game with it now.`
	};
}

/**
 * Attaches an existing game account to a profile.
 *
 * Ownership is established by the Discord email first and the account's own
 * password second — see the module comment. `rawPassword` may therefore be
 * empty: an account that already carries the visitor's Discord address does not
 * need it.
 */
export async function linkExistingGameAccount(
	userId: string,
	rawUsername: string,
	rawPassword: string,
	rawEmail: string
): Promise<AccountResult> {
	const username = validateUsername(rawUsername);
	if (!username.ok) {
		return username;
	}

	// The address comes from the identity provider and so is trustworthy, but it
	// still has to be a sane single value before it goes into the account row.
	const email = validateEmail(rawEmail);
	if (!email.ok) {
		return email;
	}

	// Empty means "I have no password for this account", not an empty password.
	const password = rawPassword ? validateExistingPassword(rawPassword) : null;
	if (password && !password.ok) {
		return password;
	}

	// The collation on `account.username` is case-insensitive, so the lookup
	// matches whatever case the visitor typed.
	const [rows] = await getAcoreAuthDb().query<AccountCredentials[]>(
		'SELECT id, email, salt, verifier FROM account WHERE username = ? LIMIT 1',
		[username.value]
	);

	const row = rows[0];

	if (!row) {
		return { ok: false, message: 'No account on this realm has that name.' };
	}

	const provenByEmail = emailsMatch(row.email ?? '', email.value);
	const provenByPassword =
		!provenByEmail &&
		password !== null &&
		verifierMatches(username.value, password.value, row.salt, row.verifier);

	if (!provenByEmail && !provenByPassword) {
		// Deliberately one message for both failures: telling them apart would
		// turn this form into a way to probe which names exist and which of them
		// carry somebody else's email address.
		return {
			ok: false,
			message:
				'That account is not registered to your Discord address, and the password did not match it either.'
		};
	}

	try {
		await getDb().insert(gameAccount).values({
			id: randomUUID(),
			userId,
			username: username.value
		});
	} catch (error) {
		if (isDuplicateEntry(error)) {
			return { ok: false, message: 'That account is already linked to a profile on this site.' };
		}

		throw error;
	}

	// Nothing to write when the address already agrees — which is exactly the
	// case for an account that was just linked by the email match.
	if (provenByPassword) {
		await syncAccountEmail(row.id, email.value);
	}

	return { ok: true, message: `Account "${username.value}" is now linked to your profile.` };
}

/**
 * Points the account's recovery address at the Discord identity that owns it.
 *
 * The only write this project makes into a database AzerothCore owns: one
 * column of one row, after ownership has been established.
 *
 * Best-effort on purpose. The link is already recorded and remains valid even
 * if this fails, so the failure is logged rather than reported — and it cannot
 * be rolled back anyway, because the two databases cannot share a transaction.
 */
async function syncAccountEmail(accountId: number, email: string): Promise<void> {
	try {
		await getAcoreAuthDb().execute('UPDATE account SET email = ? WHERE id = ? LIMIT 1', [
			email,
			accountId
		]);
	} catch (error) {
		console.error(`Could not set the email on game account id ${accountId}.`, error);
	}
}

/**
 * Removes the link only.
 *
 * The game account stays exactly as it is — characters, level and all. Deleting
 * an account is a server operation with consequences this page cannot undo, so
 * it is not offered here.
 */
export async function unlinkGameAccount(userId: string, accountId: string): Promise<AccountResult> {
	const deleted = await getDb()
		.delete(gameAccount)
		.where(and(eq(gameAccount.id, accountId), eq(gameAccount.userId, userId)));

	if (!deleted[0].affectedRows) {
		return { ok: false, message: 'That account is no longer linked to your profile.' };
	}

	return {
		ok: true,
		message: 'The account is no longer linked to this profile. It still exists on the server.'
	};
}

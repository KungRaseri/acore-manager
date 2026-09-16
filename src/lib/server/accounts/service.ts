import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2';
import { executeCommand } from '$lib/server/acore';
import { getDb } from '$lib/server/db';
import { getAcoreAuthDb } from '$lib/server/db/acore';
import { gameAccount } from '$lib/server/db/schema';
import { validateExistingPassword, validateNewPassword, validateUsername } from './rules';
import { verifierMatches } from './srp6';

/** The columns the SRP6 check needs from AzerothCore's `account` table. */
interface AccountCredentials extends RowDataPacket {
	salt: Buffer;
	verifier: Buffer;
}

/**
 * Game account provisioning and linking.
 *
 * ## Creation goes through the worldserver
 *
 * Accounts are **not** written directly into `acore_auth`. The site runs
 * `account create <username> <password>` over the worldserver's console (SOAP),
 * so the server computes the salt and SRP6 verifier itself — the same code path
 * as `.account create` typed into the console, and the same path as the wiki's
 * documented procedure. Nothing here invents its own registration format, and a
 * change to AzerothCore's registration data cannot silently diverge from us.
 *
 * ## Linking proves ownership with the account's own password
 *
 * Attaching an account that was created elsewhere (in game, or before this site
 * existed) needs the visitor to prove it is theirs. We do that by checking the
 * password they supply against the salt and verifier already on the
 * `acore_auth.account` row — the identical check the auth server makes at logon
 * (see `srp6.ts`). It is read-only: no password is set, reset, or changed, and
 * no console command is run with administrator rights on their behalf.
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
 * On failure after the account exists, the message says so — the visitor needs
 * to know they can log in with the credentials they just chose even though this
 * page does not show the account yet.
 */
export async function createGameAccount(
	userId: string,
	rawUsername: string,
	rawPassword: string
): Promise<AccountResult> {
	const username = validateUsername(rawUsername);
	if (!username.ok) {
		return username;
	}

	const password = validateNewPassword(rawPassword);
	if (!password.ok) {
		return password;
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

	const created = await runConsoleCommand(`account create ${username.value} ${password.value}`);

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
 * Attaches an existing game account after verifying the password against the
 * credentials stored on the `acore_auth` row.
 */
export async function linkExistingGameAccount(
	userId: string,
	rawUsername: string,
	rawPassword: string
): Promise<AccountResult> {
	const username = validateUsername(rawUsername);
	if (!username.ok) {
		return username;
	}

	const password = validateExistingPassword(rawPassword);
	if (!password.ok) {
		return password;
	}

	// The collation on `account.username` is case-insensitive, so the lookup
	// matches whatever case the visitor typed. This is a read: nothing about the
	// account is modified by linking it.
	const [rows] = await getAcoreAuthDb().query<AccountCredentials[]>(
		'SELECT salt, verifier FROM account WHERE username = ? LIMIT 1',
		[username.value]
	);

	const row = rows[0];

	if (!row || !verifierMatches(username.value, password.value, row.salt, row.verifier)) {
		// One message for "no such account" and "wrong password" on purpose:
		// distinguishing them would turn this form into a way to enumerate
		// account names on the realm.
		return {
			ok: false,
			message: 'No account on this realm matches that name and password.'
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

	return { ok: true, message: `Account "${username.value}" is now linked to your profile.` };
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

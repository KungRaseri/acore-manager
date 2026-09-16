/**
 * Account name and password rules.
 *
 * The hard limits come from AzerothCore itself — `AccountMgr::CreateAccount`
 * rejects a username longer than `MAX_ACCOUNT_STR`, a password longer than
 * `MAX_PASS_STR`, or an email longer than `MAX_EMAIL_STR`
 * (`azerothcore-wotlk/src/server/game/Accounts/AccountMgr.h`). Enforcing them
 * here means the user gets a sentence instead of a console error.
 *
 * Two of the rules are ours, not the server's, and both have a reason:
 *
 * 1. **Usernames are alphanumeric only.** The server does not validate the
 *    character set at all — it only uppercases what it is given — but a
 *    username is interpolated into a console command (`account create <user>
 *    <pass>`), and that command is split on spaces by the server. Anything
 *    containing whitespace would silently change which account gets created.
 * 2. **New passwords are printable non-space ASCII, 8-16 characters.** The same
 *    interpolation applies, so a space is out; the 8-character floor is our
 *    policy, not the server's (the server has no minimum at all).
 *
 * Passwords for *existing* accounts are deliberately not constrained the same
 * way — see `validateExistingPassword`.
 */

/** `MAX_ACCOUNT_STR` — a longer username is rejected by the server. */
export const MAX_USERNAME_LENGTH = 17;
/** Our choice: two-character names are not worth the support load. */
export const MIN_USERNAME_LENGTH = 3;
/** `MAX_PASS_STR` — a longer password is rejected by the server. */
export const MAX_PASSWORD_LENGTH = 16;
/** Our choice: the server accepts shorter, but a game account is a credential. */
export const MIN_PASSWORD_LENGTH = 8;

/** Alphanumeric only — no spaces, which is what the console command needs. */
const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
/** Printable ASCII without spaces: safe to put in a console command line. */
const NEW_PASSWORD_PATTERN = /^[\x21-\x7e]+$/;

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Uppercase, matching `Utf8ToUpperOnlyLatin` on the server side. The account row
 * in `acore_auth` is stored uppercase, so everything that compares against it —
 * including our mapping table — has to agree.
 */
export function normalizeUsername(value: string): string {
	return value.trim().toUpperCase();
}

export function validateUsername(value: string): Validated<string> {
	const username = normalizeUsername(value);

	if (!username) {
		return { ok: false, message: 'Enter an account name.' };
	}

	if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
		return {
			ok: false,
			message: `An account name must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters long.`
		};
	}

	if (!USERNAME_PATTERN.test(username)) {
		return {
			ok: false,
			message: 'Use letters and numbers only — no spaces or punctuation.'
		};
	}

	return { ok: true, value: username };
}

/** Rules for a password we are about to hand to `account create`. */
export function validateNewPassword(value: string): Validated<string> {
	if (!value) {
		return { ok: false, message: 'Choose a password.' };
	}

	if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
		return {
			ok: false,
			message: `A password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`
		};
	}

	if (!NEW_PASSWORD_PATTERN.test(value)) {
		return {
			ok: false,
			message: 'Use letters, numbers and punctuation — but no spaces.'
		};
	}

	return { ok: true, value };
}

/**
 * Rules for the password of an account that already exists.
 *
 * These are intentionally weak. The password is *verified* through SRP6, never
 * sent to the console, so characters the server would mangle in a command line
 * — spaces included — are perfectly legal here, and rejecting them would lock
 * out accounts that were created in-game. The only limits are presence (an
 * empty password is not a login attempt) and an upper bound that keeps the
 * hashing cost bounded for a hostile input.
 */
export function validateExistingPassword(value: string): Validated<string> {
	if (!value) {
		return { ok: false, message: 'Enter the account password.' };
	}

	if (value.length > 64) {
		return { ok: false, message: 'That password is too long to be a game account password.' };
	}

	return { ok: true, value };
}

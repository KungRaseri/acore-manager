import { error, redirect } from '@sveltejs/kit';
import type { CurrentUser } from '$lib/user';

/**
 * Authorization.
 *
 * The single place that answers "may this user do this?". Layouts call the
 * `require*` helpers, which redirect a signed-out visitor and refuse a
 * signed-in one who is not allowed — so when the rule changes, it changes here
 * and every gated route follows. Nothing else in the app should be inventing
 * access checks.
 *
 * ## The server-management gate is currently open — deliberately
 *
 * The intended rule is the GM level on the AzerothCore game account linked to
 * the signed-in user, read from `acore_auth`:
 *
 *   SELECT aa.gmlevel
 *   FROM account_access aa
 *   JOIN account a ON a.id = aa.id
 *   WHERE a.username = ? AND aa.RealmID = -1;
 *
 * `SEC_ADMINISTRATOR` (gmlevel 3) is the level the worldserver's SOAP console
 * itself demands, so a lower level could sign in but never act.
 *
 * That rule cannot be written yet, and deliberately is not guessed here: no
 * table links a website user to a game account, and account linking is not
 * built. Until it is, this admits every signed-in user — the explicit project
 * decision. Treat it as a placeholder, not as a permission model.
 */
export function isServerManager(user: CurrentUser | null): boolean {
	return user !== null;
}

/**
 * Returns the signed-in user, or redirects to the sign-in page.
 *
 * `redirectTo` is carried through the sign-in flow so the visitor lands back on
 * the page they asked for rather than the default landing route.
 */
export function requireUser(user: CurrentUser | null, redirectTo: string): CurrentUser {
	if (!user) {
		redirect(302, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}

	return user;
}

/** Refuses a signed-in user the management area is not open to. */
export function requireServerManager(user: CurrentUser): void {
	if (!isServerManager(user)) {
		error(403, 'Your account is not allowed to manage this server.');
	}
}

/**
 * Constrains a `redirectTo` value to a same-site path.
 *
 * Only a leading-slash path is accepted. `//evil.example` is a protocol-relative
 * URL that browsers follow off-site and an absolute URL is worse, so anything
 * else falls back to the caller's default. This is the classic open-redirect
 * guard, and it belongs next to the redirect it protects.
 */
export function safeRedirectTarget(value: string | null, fallback = '/dashboard'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return fallback;
	}

	return value;
}

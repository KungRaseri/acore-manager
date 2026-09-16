import { createAuthClient } from 'better-auth/svelte';

/**
 * Browser-side client for the Better Auth endpoints mounted by
 * `svelteKitHandler` in `src/hooks.server.ts`.
 *
 * No `baseURL` is passed on purpose: the client defaults to the current origin,
 * which is the same origin the session cookie is scoped to. Hardcoding an
 * origin here would break every deployment that is not localhost.
 *
 * Server-side session reads must go through `event.locals` instead — this
 * client exists for the interactions that only exist in the browser, such as
 * signing out and, later, linking a provider to the current user.
 */
export const authClient = createAuthClient();

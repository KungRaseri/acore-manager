import type { User } from 'better-auth';

/**
 * The user shape the UI is allowed to see.
 *
 * A Better Auth `User` record carries columns the browser has no business
 * holding (timestamps, verification state, and — once roles exist — whatever
 * authorization fields get added). Server code narrows to this shape before it
 * hands anything to a page, so widening the auth schema can never silently
 * widen what reaches the client.
 *
 * `import type` keeps this module free of a runtime dependency on Better Auth,
 * so it is safe to import from components.
 */
export interface CurrentUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

export function toCurrentUser(user: User): CurrentUser {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		image: user.image ?? null
	};
}

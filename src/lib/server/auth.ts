import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';

type Auth = ReturnType<typeof createAuth>;

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), { provider: 'mysql' }),
		socialProviders: {
			discord: {
				clientId: env.DISCORD_CLIENT_ID,
				clientSecret: env.DISCORD_CLIENT_SECRET
			}
		},
		plugins: [
			sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
		]
	});
}

let instance: Auth | undefined;

/**
 * The Better Auth instance, constructed on first use.
 *
 * Like the database client, this must stay lazy: constructing it at module
 * scope would read the environment and build an adapter whenever the module is
 * imported, including during the post-build analysis step of `npm run build`.
 *
 * This is what application code (hooks, load functions, actions) must use.
 */
export function getAuth(): Auth {
	instance ??= createAuth();

	return instance;
}

/**
 * The export the Better Auth CLI looks for, so that
 * `auth generate --config src/lib/server/auth.ts` (the `auth:schema` script)
 * has something to read.
 *
 * Two constraints shape it:
 *
 * 1. The CLI reads `auth.options` and nothing else — every command resolves the
 *    config with `getConfig()`, which returns `config.options`, and then uses
 *    those options directly. So this object deliberately exposes only `options`.
 * 2. It must be a plain object with `options` as an own enumerable property.
 *    The loader (`c12`) merges the loaded value through `defu` before handing it
 *    back, and `defu` copies own enumerable properties — a lazily resolving
 *    `Proxy` over an empty target would be flattened to `{}` and the CLI would
 *    report that it could not read the config.
 *
 * The getter keeps the construction lazy, so importing this module still costs
 * nothing and `npm run build` remains free of the database and the environment.
 */
export const auth = {
	get options() {
		return getAuth().options;
	}
};

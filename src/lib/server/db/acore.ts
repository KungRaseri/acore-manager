import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

/**
 * Clients for the AzerothCore databases.
 *
 * These databases are **owned and migrated by AzerothCore**, not by this
 * project. So they are plain `mysql2` pools: no Drizzle schema, no migrations,
 * and `drizzle-kit` must never be pointed at them. AzerothCore applies its own
 * SQL updates from `data/sql/updates/`.
 *
 * Add a database here when you need one — this list is the only place the names
 * live.
 */
export const ACORE_DATABASES = [
	'acore_auth',
	'acore_world',
	'acore_characters',
	'acore_playerbots'
] as const;

export type AcoreDatabase = (typeof ACORE_DATABASES)[number];

const pools = new Map<AcoreDatabase, mysql.Pool>();

function createPool(database: AcoreDatabase) {
	if (!env.ACORE_DATABASE_URL) {
		throw new Error(
			'ACORE_DATABASE_URL is not set. It must point at the AzerothCore MySQL server ' +
				'(for example mysql://user:password@host:3306) — the database name is chosen per client.'
		);
	}

	const url = new URL(env.ACORE_DATABASE_URL);

	// Only the database name differs between these clients, so it comes from the
	// argument rather than from the URL's path.
	return mysql.createPool({
		host: url.hostname,
		port: url.port ? Number(url.port) : 3306,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database
	});
}

/**
 * Pool for one AzerothCore database, created on first use and reused after that.
 *
 * Lazy for the same reason as `getDb()`: nothing may open a connection while the
 * module graph is merely being imported (the build does that).
 */
export function getAcoreDb(database: AcoreDatabase): mysql.Pool {
	const existing = pools.get(database);

	if (existing) {
		return existing;
	}

	const pool = createPool(database);
	pools.set(database, pool);

	return pool;
}

export function getAcoreAuthDb(): mysql.Pool {
	return getAcoreDb('acore_auth');
}

export function getAcoreWorldDb(): mysql.Pool {
	return getAcoreDb('acore_world');
}

export function getAcoreCharactersDb(): mysql.Pool {
	return getAcoreDb('acore_characters');
}

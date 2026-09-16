import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

function createDb() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const pool = mysql.createPool(env.DATABASE_URL);

	return drizzle(pool, { schema, mode: 'default' });
}

let database: ReturnType<typeof createDb> | undefined;

/**
 * The Drizzle client for **this project's own database** (`acore_manager`),
 * constructed on first use.
 *
 * This must stay lazy. Building the pool at module scope creates a connection
 * whenever the module is imported, and SvelteKit's post-build analysis step
 * imports the built server bundle — so an eager client either throws on a
 * missing DATABASE_URL or opens a connection during `npm run build`.
 *
 * For AzerothCore's databases use `./acore` instead — those are not managed by
 * Drizzle and must not be.
 */
export function getDb(): ReturnType<typeof createDb> {
	database ??= createDb();

	return database;
}

export {
	ACORE_DATABASES,
	getAcoreAuthDb,
	getAcoreCharactersDb,
	getAcoreDb,
	getAcoreWorldDb,
	type AcoreDatabase
} from './acore';

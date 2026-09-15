/**
 * Runtime database bootstrap and migrations.
 *
 * Run by docker-entrypoint.sh before the app starts, and safe to run by hand:
 *
 *     node migrate.mjs
 *
 * Two jobs, in order:
 *
 *   1. Create the database if it does not exist. Drizzle never creates the
 *      database itself — `migrate()` expects one to already be there — so a
 *      fresh MySQL server cannot be brought up by migrations alone.
 *   2. Apply the Drizzle migrations in ./drizzle.
 *
 * Idempotent: `CREATE DATABASE IF NOT EXISTS` is a no-op on later runs, and
 * Drizzle records applied migrations in `__drizzle_migrations`, so restarting
 * the container does nothing.
 *
 * Needs only runtime dependencies (drizzle-orm + mysql2) — never drizzle-kit.
 */
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONNECT_ATTEMPTS = 12;
const CONNECT_DELAY_MS = 5000;

function fail(message) {
	console.error(`[migrate] ${message}`);
	process.exit(1);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	fail('DATABASE_URL is not set — aborting. Set it in .env or in the container environment.');
}

let parsed;
try {
	parsed = new URL(databaseUrl);
} catch {
	fail(`DATABASE_URL is not a valid URL: ${databaseUrl}`);
}

const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
if (!databaseName) {
	fail('DATABASE_URL must include a database name, e.g. mysql://user:pass@host:3306/acore_manager');
}
if (databaseName.includes('`')) {
	fail('The database name must not contain a backtick.');
}

const connectionOptions = {
	host: parsed.hostname,
	port: parsed.port ? Number(parsed.port) : 3306,
	user: decodeURIComponent(parsed.username),
	password: decodeURIComponent(parsed.password)
};

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), 'drizzle');

/**
 * Connects, retrying while the database is still coming up. Containers are
 * routinely started alongside their database, so a single attempt would make
 * startup order fragile.
 */
async function connectWithRetry(extra = {}) {
	let lastError;

	for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
		try {
			return await mysql.createConnection({ ...connectionOptions, ...extra });
		} catch (error) {
			lastError = error;
			console.log(
				`[migrate] Waiting for ${connectionOptions.host}:${connectionOptions.port} ` +
					`(attempt ${attempt}/${CONNECT_ATTEMPTS}) — ${error.code ?? error.message}`
			);

			if (attempt < CONNECT_ATTEMPTS) {
				await sleep(CONNECT_DELAY_MS);
			}
		}
	}

	fail(`Could not reach the database: ${lastError?.message ?? lastError}`);
}

// ---------------------------------------------------------------------------
// 1. Ensure the database exists
// ---------------------------------------------------------------------------

console.log(
	`[migrate] Ensuring database \`${databaseName}\` exists on ` +
		`${connectionOptions.host}:${connectionOptions.port}...`
);

const admin = await connectWithRetry();

try {
	await admin.query(
		`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
	);
	console.log(`[migrate] Database \`${databaseName}\` is ready.`);
} catch (error) {
	if (error.code === 'ER_DBACCESS_DENIED_ERROR' || error.code === 'ER_ACCESS_DENIED_ERROR') {
		fail(
			`The user "${connectionOptions.user}" is not allowed to create databases. ` +
				`Create it once by hand (CREATE DATABASE \`${databaseName}\`), or grant CREATE on *.*, then re-run.`
		);
	}

	throw error;
} finally {
	await admin.end();
}

// ---------------------------------------------------------------------------
// 2. Apply migrations
// ---------------------------------------------------------------------------

let hasMigrations = false;
const journalPath = join(migrationsFolder, 'meta', '_journal.json');

if (existsSync(journalPath)) {
	try {
		const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
		hasMigrations = Array.isArray(journal.entries) && journal.entries.length > 0;
	} catch (error) {
		fail(`Could not read ${journalPath}: ${error.message}`);
	}
}

if (!hasMigrations) {
	console.warn(
		`[migrate] No migrations found in ${migrationsFolder} — the database exists but has no tables.\n` +
			'[migrate] Generate the first one with `npm run db:generate`, commit it, then re-run.'
	);
	process.exit(0);
}

const pool = mysql.createPool({
	...connectionOptions,
	database: databaseName,
	connectionLimit: 1
});

try {
	console.log(`[migrate] Applying migrations from ${migrationsFolder}...`);
	await migrate(drizzle(pool), { migrationsFolder });
	console.log('[migrate] Migrations complete.');
} finally {
	await pool.end();
}

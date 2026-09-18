import {
	index,
	int,
	mysqlTable,
	text,
	timestamp,
	tinyint,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import { user } from './auth.schema';

export * from './auth.schema';

/**
 * Which AzerothCore game account belongs to which website user.
 *
 * This is the *only* thing the site stores about a game account: the account
 * itself lives in AzerothCore's `acore_auth.account`, which this project never
 * writes to directly — accounts are created by the worldserver through its own
 * console command, so the server owns the salt and verifier.
 *
 * `username` is stored uppercase because that is what `AccountMgr::CreateAccount`
 * does before inserting (`Utf8ToUpperOnlyLatin`), so the mapping always matches
 * the row in `acore_auth`. It is unique: one game account can only ever belong
 * to one website user, and that constraint is enforced by the database rather
 * than by application logic.
 *
 * A missing row means "not linked", never "does not exist" — deleting a row
 * here (unlinking) leaves the game account untouched on the server.
 */
export const gameAccount = mysqlTable(
	'game_account',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		userId: varchar('user_id', { length: 36 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		username: varchar('username', { length: 32 }).notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('game_account_username_unique').on(table.username),
		index('game_account_userId_idx').on(table.userId)
	]
);

/**
 * The append-only record of every console command attempt made through the
 * site.
 *
 * Two things about this table are deliberate and should not be "fixed":
 *
 * 1. **`user_id` has no foreign key to `user`.** Every other table in this
 *    project that points at a profile cascades, because it stores *data* that
 *    belongs to the profile. This one stores *events*. A cascade would delete
 *    the history of a deleted profile, which is the opposite of what an audit
 *    trail is for, so the column is a plain indexed id: it joins to `user`
 *    while the profile exists and stays readable as `actor_name` after it does
 *    not. The cost is referential integrity, and it is paid on purpose.
 * 2. **`status` and `failure_reason` are varchars, not enums.** The statuses
 *    (`pending` / `success` / `failed` / `refused`) are fixed, but the failure
 *    reasons mirror `SoapFailureReason` in
 *    [`../acore/soap.ts`](../acore/soap.ts), which grows as the SOAP client
 *    learns about new failures — and adding an enum value is a DDL change.
 *
 * The row is written in two phases rather than one: the intent (`pending`) is
 * inserted *before* anything is sent to the worldserver, and the outcome
 * updates that same row. `acore_manager` and AzerothCore cannot share a
 * transaction, and here the gap is not between two databases but across a SOAP
 * call that can run for ten seconds — holding a MySQL transaction open across
 * it would pin a pool connection to protect nothing. A crash between the two
 * leaves a `pending` row, which is honest: something was attempted and no
 * outcome was recorded.
 *
 * `output` is truncated by the writer at `MAX_AUDIT_OUTPUT_CHARS` (2000, see
 * [`$lib/gm-commands`](../../gm-commands.ts)), so a long listing loses its
 * tail — that is a bound on the column, not a rendering choice, and the pages
 * that show it say so. `duration_ms` is how a queue building up behind the
 * serialised SOAP client becomes visible at all.
 *
 * Retention: everything is kept and nothing prunes. One row per execution is
 * negligible at private-realm staff volumes, this app has no scheduler in which
 * to run a retention job, and the trail is append-only — no UI edits or deletes
 * a row.
 */
export const commandAudit = mysqlTable(
	'command_audit',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		/** The acting profile. Intentionally **not** a foreign key — see above. */
		userId: varchar('user_id', { length: 36 }).notNull(),
		/** The display name at the time, so the row survives a rename or a deletion. */
		actorName: varchar('actor_name', { length: 255 }).notNull(),
		/** The effective gmlevel the check actually used. */
		actorLevel: tinyint('actor_level', { unsigned: true }).notNull(),
		/** The catalogue name, never a line of text taken from the form. */
		command: varchar('command', { length: 64 }).notNull(),
		/** The validated argument string, verbatim, or NULL when there were none. */
		arguments: varchar('arguments', { length: 1000 }),
		/** Best-effort first argument, for search. `arguments` is the authority. */
		target: varchar('target', { length: 64 }),
		/** `pending` / `success` / `failed` / `refused`. */
		status: varchar('status', { length: 16 }).notNull(),
		/** Mirrors `SoapFailureReason`, plus `refused`. NULL on success. */
		failureReason: varchar('failure_reason', { length: 32 }),
		/** The human-readable failure, as the operator saw it. */
		message: varchar('message', { length: 512 }),
		/** The console's own reply, truncated to `MAX_AUDIT_OUTPUT_CHARS`. */
		output: text('output'),
		durationMs: int('duration_ms', { unsigned: true }),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		/** Set with the outcome; NULL while the row is still `pending`. */
		finishedAt: timestamp('finished_at', { fsp: 3 })
	},
	(table) => [
		/** The trail is read newest-first. */
		index('command_audit_created_at_idx').on(table.createdAt),
		/**
		 * "What did this profile do". A composite rather than two single-column
		 * indexes, because MySQL can serve the second question from this one and
		 * cannot serve this one from two singles.
		 */
		index('command_audit_user_id_created_at_idx').on(table.userId, table.createdAt),
		/** "Every time this command was used". */
		index('command_audit_command_idx').on(table.command)
	]
);

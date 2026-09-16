import { index, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
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

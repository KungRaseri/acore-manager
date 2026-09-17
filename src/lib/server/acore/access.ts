import type { RowDataPacket } from 'mysql2';
import { SEC_PLAYER } from '$lib/access';
import { getAcoreAuthDb } from '$lib/server/db/acore';

/**
 * GM levels, read from AzerothCore's `acore_auth`.
 *
 * This is the integration-layer half of authorization: it answers "what level
 * does the server think this game account has?" and nothing else. Which level
 * may reach which page is policy and lives in `$lib/server/authz`, so changing
 * the ladder never has to touch SQL.
 *
 * Read-only. `account_access` is AzerothCore's table, written by whoever grants
 * staff levels in game or through the console, and this project must never
 * insert into it: a level the site invented would be a level the server does not
 * recognise.
 */

/** One account's effective level, as `account_access` reports it. */
interface LevelRow extends RowDataPacket {
	username: string;
	gmlevel: number | null;
}

/**
 * The GM level of each of `usernames`, keyed by **uppercased** account name.
 *
 * AzerothCore stores account names uppercase (`AccountMgr::CreateAccount` runs
 * `Utf8ToUpperOnlyLatin`), and this normalises both sides, so a caller can look
 * a name up without caring how it was written. An account with no
 * `account_access` row is present in the result at level `0` — it exists and
 * simply has no staff standing, which is not the same as "unknown".
 *
 * A name that does not exist on the server at all is absent from the result.
 */
export async function readAccountLevels(
	usernames: readonly string[]
): Promise<Map<string, number>> {
	const levels = new Map<string, number>();

	if (usernames.length === 0) {
		return levels;
	}

	/*
		`LEFT JOIN` so an account with no `account_access` row still comes back.
		`MAX` collapses the table's one-row-per-realm shape into a single level per
		account, and there is deliberately no `RealmID` filter: this site has no
		realm model, so any row is taken as evidence of staff standing. A
		realm-scoped game master therefore gets site-wide staff access — the known
		widening, recorded in `plans/gm-level-gating.md`.

		The lookup walks `account`'s unique name key and joins on
		`account_access`'s primary key, so it is indexed on both sides. Placeholders
		are generated from the list, exactly as `listPlayerAccounts` does, because
		the list length is not known ahead of time.
	*/
	const [rows] = await getAcoreAuthDb().query<LevelRow[]>(
		`SELECT a.username AS username, MAX(aa.gmlevel) AS gmlevel
		FROM account a
		LEFT JOIN account_access aa ON aa.id = a.id
		WHERE a.username IN (${usernames.map(() => '?').join(', ')})
		GROUP BY a.username`,
		[...usernames]
	);

	for (const row of rows) {
		levels.set(row.username.toUpperCase(), row.gmlevel ?? SEC_PLAYER);
	}

	return levels;
}

import type { RowDataPacket } from 'mysql2';
import { getAcoreCharactersDb } from '$lib/server/db/acore';

/**
 * Characters, read from AzerothCore's `acore_characters`.
 *
 * Read-only, on the lazy `mysql2` pool, for the reason in
 * [`db/acore.ts`](../db/acore.ts): these tables are AzerothCore's, migrated by
 * its own SQL updater, and must never be declared in a Drizzle schema or handed
 * to `drizzle-kit`. Nothing in this module writes.
 *
 * **Scope is part of the contract.** Every query takes the account id, never a
 * `guid` on its own, even where the guid is a primary key: a guid is a small
 * integer anyone can count up, so the account is what makes a read safe. The
 * caller proves account ownership first — see
 * [`requireOwnedAccount`](../authz.ts).
 */

/** How many equipment slots AzerothCore stores inline: `EQUIPMENT_SLOT_END` is 19. */
const EQUIPMENT_SLOT_END = 19;

/** A character, as the account's character list shows it. */
export interface CharacterSummary {
	guid: number;
	name: string;
	race: number;
	class: number;
	gender: number;
	level: number;
	online: boolean;
	/** Copper, as stored: see `formatMoney` in `$lib/characters`. */
	money: number;
	/** Seconds played in total, and at the current level. */
	totalTime: number;
	levelTime: number;
	/** Unix seconds; `0` when the server has never recorded a logout. */
	logoutTime: number;
	/** `areatable_dbc` ids for the character's zone and the map it stands on. */
	zoneId: number;
	mapId: number;
	/** Unix seconds. */
	createdAt: number;
	guildName: string | null;
	guildRank: number | null;
	/** The rank's own name, as `guild_rank.rname` — "Officer", not "3". */
	guildRankName: string | null;
}

/** A character whose account has deleted it, still restorable in game. */
export interface DeletedCharacter {
	guid: number;
	name: string;
	level: number;
	race: number;
	class: number;
	gender: number;
	/** Unix seconds the character was deleted. */
	deletedAt: number;
}

/** One equipped item: which slot, which entry, and how many. */
export interface EquippedItem {
	slot: number;
	entry: number;
	count: number;
	durability: number;
}

/** One trained skill, with its current and maximum value. */
export interface CharacterSkill {
	skill: number;
	value: number;
	max: number;
}

interface CharacterRow extends RowDataPacket {
	guid: number;
	name: string;
	race: number;
	class: number;
	gender: number;
	level: number;
	online: number;
	money: number;
	totalTime: number;
	levelTime: number;
	logoutTime: number;
	zone: number;
	map: number;
	createdAt: Date | string;
	guildName: string | null;
	guildRank: number | null;
	guildRankName: string | null;
}

interface DeletedRow extends RowDataPacket {
	guid: number;
	name: string;
	level: number;
	race: number;
	class: number;
	gender: number;
	deletedAt: number;
}

interface EquippedRow extends RowDataPacket {
	slot: number;
	entry: number;
	count: number;
	durability: number;
}

interface SkillRow extends RowDataPacket {
	skill: number;
	value: number;
	max: number;
}

/** A `timestamp` column read back as unix seconds, whatever the driver handed over. */
function toUnixSeconds(value: Date | string): number {
	return Math.floor(new Date(value).getTime() / 1000);
}

function toSummary(row: CharacterRow): CharacterSummary {
	return {
		guid: row.guid,
		name: row.name,
		race: row.race,
		class: row.class,
		gender: row.gender,
		level: row.level,
		online: row.online > 0,
		money: row.money,
		totalTime: row.totalTime,
		levelTime: row.levelTime,
		logoutTime: row.logoutTime,
		zoneId: row.zone,
		mapId: row.map,
		createdAt: toUnixSeconds(row.createdAt),
		guildName: row.guildName,
		guildRank: row.guildRank,
		guildRankName: row.guildRankName
	};
}

/*
	The column list is shared by the list and the detail so the two can never
	drift: one character reads the same way whether it is being listed or opened.
	The guild columns come from `guild_member` (one row per character — `guid` is
	unique there) and `guild`, so a character in no guild simply has nulls.

	`creation_date` is a real `timestamp`, which is why it is read as a date here
	and converted once, rather than being treated as a unix integer like
	`logout_time`.
*/
const CHARACTER_COLUMNS = `
	c.guid, c.name, c.race, c.class, c.gender, c.level, c.online, c.money,
	c.totaltime AS totalTime, c.leveltime AS levelTime, c.logout_time AS logoutTime,
	c.zone, c.map, c.creation_date AS createdAt,
	g.name AS guildName, gm.rank AS guildRank, gr.rname AS guildRankName`;

const CHARACTER_FROM = `
	FROM characters c
	LEFT JOIN guild_member gm ON gm.guid = c.guid
	LEFT JOIN guild g ON g.guildid = gm.guildid
	LEFT JOIN guild_rank gr ON gr.guildid = gm.guildid AND gr.rid = gm.rank`;

/**
 * Every character on an account.
 *
 * The `account` column is indexed in AzerothCore's own schema (`idx_account`),
 * so this is one index read. Deleted characters are absent by construction:
 * deletion sets `account` to `0`, so they cannot appear here — see
 * [`listDeletedCharacters`](#listDeletedCharacters).
 */
export async function listCharacters(accountId: number): Promise<CharacterSummary[]> {
	const [rows] = await getAcoreCharactersDb().query<CharacterRow[]>(
		`SELECT ${CHARACTER_COLUMNS} ${CHARACTER_FROM}
		WHERE c.account = ?
		ORDER BY c.level DESC, c.name`,
		[accountId]
	);

	return rows.map(toSummary);
}

/**
 * One character, scoped to the account that owns it.
 *
 * The guid alone would be enough for the primary key, and that is exactly why the
 * account is in the `WHERE` as well: it turns "any character" into "this
 * character, if it really belongs to the account whose ownership was proved".
 */
export async function findCharacter(
	accountId: number,
	guid: number
): Promise<CharacterSummary | null> {
	const [rows] = await getAcoreCharactersDb().query<CharacterRow[]>(
		`SELECT ${CHARACTER_COLUMNS} ${CHARACTER_FROM}
		WHERE c.account = ? AND c.guid = ?
		LIMIT 1`,
		[accountId, guid]
	);

	return rows[0] ? toSummary(rows[0]) : null;
}

/**
 * The characters this account has deleted, newest first.
 *
 * Deletion in AzerothCore does **not** remove the row. It moves the identity
 * aside so the character can be restored in game
 * (`UPDATE characters SET deleteInfos_Name = name, deleteInfos_Account = account,
 * deleteDate = UNIX_TIMESTAMP(), name = '', account = 0`), which is why this
 * query filters on `deleteInfos_Account` and reads the name back from
 * `deleteInfos_Name` — `account` and `name` are blank on those rows, and a query
 * against `account` would quietly return nothing at all.
 *
 * The rest of the row is left as it was, so level, race and class are still the
 * character's own.
 */
export async function listDeletedCharacters(accountId: number): Promise<DeletedCharacter[]> {
	const [rows] = await getAcoreCharactersDb().query<DeletedRow[]>(
		`SELECT guid, deleteInfos_Name AS name, level, race, class, gender, deleteDate AS deletedAt
		FROM characters
		WHERE deleteDate IS NOT NULL AND deleteInfos_Account = ?
		ORDER BY deleteDate DESC`,
		[accountId]
	);

	return rows.map((row) => ({
		guid: row.guid,
		// A row deleted before the name was recorded would otherwise render blank.
		name: row.name || `Character ${row.guid}`,
		level: row.level,
		race: row.race,
		class: row.class,
		gender: row.gender,
		deletedAt: row.deletedAt
	}));
}

/**
 * What a character is wearing.
 *
 * AzerothCore keeps the equipped set in the main inventory row: `bag = 0` and a
 * slot below `EQUIPMENT_SLOT_END` (0 head, 15 back, 16 main hand, 17 off hand,
 * 18 ranged — the order the client shows). Everything else in that table is
 * carried or banked, so it is left out here.
 *
 * `idx_guid` on `character_inventory` makes this one index read, and the join to
 * `item_instance` is on its primary key.
 */
export async function listEquippedItems(guid: number): Promise<EquippedItem[]> {
	const [rows] = await getAcoreCharactersDb().query<EquippedRow[]>(
		`SELECT ci.slot AS slot, ii.itemEntry AS entry, ii.count AS count, ii.durability AS durability
		FROM character_inventory ci
		JOIN item_instance ii ON ii.guid = ci.item
		WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot < ?
		ORDER BY ci.slot`,
		[guid, EQUIPMENT_SLOT_END]
	);

	return rows;
}

/**
 * Every skill the character has trained, most developed first.
 *
 * The primary key is `(guid, skill)`, so this is a single index read. The rows
 * include weapon and armour skills and languages alongside the professions, and
 * they are shown together on purpose: the world database has no
 * `skilllinecategory_dbc`, so there is nothing authoritative to sort professions
 * apart by, and inventing a list of profession ids would be a guess that ages
 * badly. Ordering by value puts the trained professions at the top anyway.
 */
export async function listSkills(guid: number): Promise<CharacterSkill[]> {
	const [rows] = await getAcoreCharactersDb().query<SkillRow[]>(
		'SELECT skill, value, max FROM character_skills WHERE guid = ? ORDER BY value DESC, skill',
		[guid]
	);

	return rows;
}

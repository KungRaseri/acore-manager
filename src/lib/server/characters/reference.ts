import type { RowDataPacket } from 'mysql2';
import { env } from '$env/dynamic/private';
import { itemIconUrl, usableIconBase } from '$lib/characters';
import { getAcoreWorldDb } from '$lib/server/db/acore';

/**
 * Names and item details, read from AzerothCore's **world** database.
 *
 * `acore_characters` stores ids — a race number, a class number, an item entry —
 * and the names for those live in `acore_world`, mostly in the `*_dbc` tables
 * that AzerothCore populates from the game client's own DBC files. Reading them
 * rather than hardcoding a list is the point: the client renders the same tables,
 * so a custom race or a renamed skill shows up here exactly as it does in game.
 *
 * Read-only, on the same lazy pool as everything else in `$lib/server/acore`.
 * One query per reference set, called once per page — reference data is cheap
 * enough to re-read on every request, and caching it is not worth the stale
 * state it would introduce (see the "Nothing is cached" note in
 * `$lib/server/authz`, which sets the tone for the whole project).
 */

/** An item as the character pages show it. */
export interface ItemSummary {
	entry: number;
	name: string;
	quality: number;
	itemLevel: number;
	/** Ready to render; `null` when the entry has no display record. */
	iconUrl: string | null;
}

/** A race's name and side, as `chrraces_dbc` reports them. */
export interface RaceInfo {
	name: string;
	alliance: boolean;
}

interface ClassRow extends RowDataPacket {
	ID: number;
	Name_Lang_enUS: string | null;
}

interface RaceRow extends RowDataPacket {
	ID: number;
	Name_Lang_enUS: string | null;
	Alliance: number;
}

interface AreaRow extends RowDataPacket {
	ID: number;
	AreaName_Lang_enUS: string | null;
}

interface SkillRow extends RowDataPacket {
	ID: number;
	DisplayName_Lang_enUS: string | null;
}

interface ItemRow extends RowDataPacket {
	entry: number;
	name: string;
	quality: number;
	itemLevel: number;
	icon: string | null;
}

/**
 * Where the icon files are served from.
 *
 * `itemdisplayinfo_dbc` gives the icon's *name*, and the matching texture is one
 * of the files extracted from the client's MPQ archives into
 * `static/interface/Icons` — so the default is this site, and a player's browser
 * fetches item icons from here and nowhere else.
 *
 * Those textures are **not in git and not in the container image** (both ignore
 * `static/interface`: the artwork is Blizzard's, and this repository is not a
 * distribution channel for it). The app is built to work without them — an icon
 * the browser cannot fetch falls back to a placeholder — so `ICON_BASE_URL` is
 * only for the deployment that does not have the files locally and does have a
 * host that serves them.
 *
 * An unusable value is ignored rather than honoured, and said so in the log —
 * see [`usableIconBase`](src/lib/characters.ts). Silently honouring one means
 * every icon turns into the same placeholder with nothing to explain why.
 */
function iconBaseUrl(): string {
	const configured = env.ICON_BASE_URL?.trim();
	const base = usableIconBase(configured);

	if (configured && base !== configured) {
		console.warn(
			`[characters] ignoring ICON_BASE_URL="${configured}": it must be a root-relative path or an absolute http(s) URL. Using ${base} instead.`
		);
	}

	return base;
}

/** Every playable class, by id. Eleven rows in 3.3.5a, so reading them all is cheapest. */
export async function readClasses(): Promise<Map<number, string>> {
	const [rows] = await getAcoreWorldDb().query<ClassRow[]>(
		'SELECT ID, Name_Lang_enUS FROM chrclasses_dbc ORDER BY ID'
	);

	return new Map(rows.map((row) => [row.ID, row.Name_Lang_enUS || `Class ${row.ID}`]));
}

/** Every playable race, by id, with its side. */
export async function readRaces(): Promise<Map<number, RaceInfo>> {
	const [rows] = await getAcoreWorldDb().query<RaceRow[]>(
		'SELECT ID, Name_Lang_enUS, Alliance FROM chrraces_dbc ORDER BY ID'
	);

	return new Map(
		rows.map((row) => [
			row.ID,
			{ name: row.Name_Lang_enUS || `Race ${row.ID}`, alliance: row.Alliance === 1 }
		])
	);
}

/** Names for the given area ids — a character's zone, and the map it stands on. */
export async function readAreas(ids: readonly number[]): Promise<Map<number, string>> {
	const unique = [...new Set(ids)].filter((id) => id > 0);

	if (unique.length === 0) {
		return new Map();
	}

	const [rows] = await getAcoreWorldDb().query<AreaRow[]>(
		`SELECT ID, AreaName_Lang_enUS FROM areatable_dbc WHERE ID IN (${unique.map(() => '?').join(', ')})`,
		unique
	);

	return new Map(rows.map((row) => [row.ID, row.AreaName_Lang_enUS || `Area ${row.ID}`]));
}

/** Names for the given skill ids. */
export async function readSkills(ids: readonly number[]): Promise<Map<number, string>> {
	const unique = [...new Set(ids)].filter((id) => id > 0);

	if (unique.length === 0) {
		return new Map();
	}

	const [rows] = await getAcoreWorldDb().query<SkillRow[]>(
		`SELECT ID, DisplayName_Lang_enUS FROM skillline_dbc WHERE ID IN (${unique.map(() => '?').join(', ')})`,
		unique
	);

	return new Map(rows.map((row) => [row.ID, row.DisplayName_Lang_enUS || `Skill ${row.ID}`]));
}

/*
	Once per process, because the condition is a property of the realm rather than
	of the request: with no display records anywhere, every page render would
	otherwise repeat the same warning.
*/
let warnedAboutMissingIcons = false;

function warnIfNoIconsAtAll(rows: ItemRow[]): void {
	if (warnedAboutMissingIcons || rows.length === 0 || rows.some((row) => row.icon)) {
		return;
	}

	warnedAboutMissingIcons = true;
	console.warn(
		'[characters] no item display records were found in the world database, so every item icon will fall back to a placeholder. `acore_world.itemdisplayinfo_dbc` ships empty in AzerothCore and is only populated when a realm dumps its client DBCs — see AGENTS.md, Characters.'
	);
}

/**
 * Name, quality, item level and icon for the given item entries.
 *
 * A `LEFT JOIN` on purpose: the display record can be missing, and an item whose
 * icon is unknown is still worth showing by name. An entry that is **not in the
 * result at all** is an orphan — the character holds an item the world database
 * no longer defines — which the page reports as unknown rather than hiding, so a
 * broken item is visible instead of silently absent.
 */
export async function readItems(entries: readonly number[]): Promise<Map<number, ItemSummary>> {
	const unique = [...new Set(entries)].filter((entry) => entry > 0);

	if (unique.length === 0) {
		return new Map();
	}

	const [rows] = await getAcoreWorldDb().query<ItemRow[]>(
		`SELECT t.entry AS entry, t.name AS name, t.Quality AS quality, t.ItemLevel AS itemLevel,
			d.InventoryIcon_1 AS icon
		FROM item_template t
		LEFT JOIN itemdisplayinfo_dbc d ON d.ID = t.displayid
		WHERE t.entry IN (${unique.map(() => '?').join(', ')})`,
		unique
	);

	warnIfNoIconsAtAll(rows);

	const base = iconBaseUrl();

	return new Map(
		rows.map((row) => [
			row.entry,
			{
				entry: row.entry,
				name: row.name,
				quality: row.quality,
				itemLevel: row.itemLevel,
				iconUrl: itemIconUrl(row.icon, base)
			}
		])
	);
}

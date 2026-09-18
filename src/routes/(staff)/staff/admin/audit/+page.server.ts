import type { PageServerLoad } from './$types';
import { MAX_AUDIT_OUTPUT_CHARS } from '$lib/gm-commands';
import { AUDIT_PAGE_SIZE, readAuditPage } from '$lib/server/commands/audit';

/**
 * The audit trail's server half: one page of rows, newest first, and nothing else.
 *
 * ## Read-only, and there are no actions
 *
 * The trail is append-only. This module exports `load` and no `actions` at all, so
 * no request can POST to the page and nothing here edits, deletes, prunes or
 * exports a row. Reading is the whole of it.
 *
 * ## Why the page is handed strings and never a `Date`
 *
 * `timestamp(3)` columns arrive as `Date` objects and SvelteKit would serialise
 * them happily, but this is a forensic record: the load converts each timestamp to
 * ISO 8601 UTC exactly once, so the page formats nothing, no reader's locale can
 * move a timestamp, and the server and the browser cannot disagree about what a row
 * says. `outputTruncated` is the same idea for the console's reply — the writer
 * keeps at most `MAX_AUDIT_OUTPUT_CHARS` characters, so a reply that sits at
 * exactly that length has lost its tail, and the page has to say so rather than
 * let the text appear to end by itself.
 *
 * ## Paging, and the total nobody counts
 *
 * `?page=` is read here and sanitised by the reader, which reports the page it
 * actually read — that value, not the URL's, is what the page renders. The trail is
 * never counted: `hasMore` comes from reading a single row past the page, so
 * rendering a page costs one index-ordered scan instead of a `COUNT(*)` over a
 * table that is never pruned. The consequence is visible in the UI on purpose: the
 * page knows how many pages exist only as far as it has read.
 */

/** One row as the page renders it: plain values only, nothing server-only. */
export interface AuditTrailRow {
	id: string;
	/** The display name at the time of the attempt, so a rename cannot rewrite history. */
	actorName: string;
	/** The effective gmlevel the action's check actually used. */
	actorLevel: number;
	/** The catalogue's own name — never a line of text taken from a form. */
	command: string;
	/** The validated arguments, verbatim, or `null` when the command takes none. */
	arguments: string | null;
	/**
	 * `pending` / `success` / `failed` / `refused`, as the column holds it.
	 *
	 * Typed as `string` rather than a union on purpose: the column is a varchar, so a
	 * row can hold a token this build has never seen, and the page renders it with a
	 * neutral fallback instead of coercing it into a familiar status.
	 */
	status: string;
	/** The SOAP failure reason, or `refused` for a command the site never sent. */
	failureReason: string | null;
	/** The human-readable failure, as the operator saw it. */
	message: string | null;
	/** The console's own reply, already capped at `MAX_AUDIT_OUTPUT_CHARS` by the writer. */
	output: string | null;
	/** Whether `output` reached the truncation limit, i.e. its tail was never stored. */
	outputTruncated: boolean;
	/** How long the SOAP call took; `null` on a row that never reached the console. */
	durationMs: number | null;
	/** ISO 8601 UTC — when the attempt was recorded. */
	createdAt: string;
	/**
	 * ISO 8601 UTC when an outcome was written, and **`null` while the row is
	 * `pending`**: that is precisely the case that means the process died between
	 * sending the command and recording what came back.
	 */
	finishedAt: string | null;
}

/** The load's whole payload — plain and JSON-serialisable by construction. */
export interface AuditTrailData {
	rows: AuditTrailRow[];
	/** The page the reader actually read, after it sanitised whatever the URL said. */
	page: number;
	/** Rows per page, echoed so the page can describe its own paging. */
	pageSize: number;
	/** Whether a further page exists, known by reading one row past this one. */
	hasMore: boolean;
	/** `true` when the trail could not be read at all — which is not an empty trail. */
	unavailable: boolean;
	/** The sentence to show instead of rows when `unavailable` is set, else `null`. */
	message: string | null;
}

/*
	Written server-side so the same sentence reaches the browser and the log. It names
	no table contents deliberately: an administrator reading it needs to know that
	nothing was read and nothing was changed, and that the site's own database is the
	one to check — the trail lives in `acore_manager`, not in AzerothCore.
*/
const UNAVAILABLE_MESSAGE =
	'The audit trail could not be read, so no attempt is listed here. The trail is stored in the site database (acore_manager), not in AzerothCore, so DATABASE_URL and the MySQL connection are what to check. This page only reads: nothing was changed.';

/** The row shape the reader returns, taken from the reader rather than re-declared. */
type AuditRecord = Awaited<ReturnType<typeof readAuditPage>>['rows'][number];

function toTrailRow(row: AuditRecord): AuditTrailRow {
	return {
		id: row.id,
		actorName: row.actorName,
		actorLevel: row.actorLevel,
		command: row.command,
		arguments: row.arguments,
		status: row.status,
		failureReason: row.failureReason,
		message: row.message,
		output: row.output,
		// The column is capped rather than flagged, so "at the cap" is the only honest
		// signal that the tail is missing. A reply of exactly the cap length reports
		// itself as possibly truncated, which errs towards telling the reader less than
		// the table holds, never more.
		outputTruncated: (row.output?.length ?? 0) >= MAX_AUDIT_OUTPUT_CHARS,
		durationMs: row.durationMs,
		createdAt: row.createdAt.toISOString(),
		finishedAt: row.finishedAt?.toISOString() ?? null
	};
}

export const load = (async ({ url }) => {
	/*
		`Number(...)` of a missing parameter is `1` and of a garbled one is `NaN`, and
		`readAuditPage()` reads anything that is not a whole number at or above 1 as
		page 1 — so a hand-typed URL cannot walk the offset around with a string the
		reader never agreed to.
	*/
	const requested = Number(url.searchParams.get('page') ?? 1);

	try {
		const auditPage = await readAuditPage(requested);

		return {
			rows: auditPage.rows.map(toTrailRow),
			page: auditPage.page,
			pageSize: auditPage.pageSize,
			hasMore: auditPage.hasMore,
			unavailable: false,
			message: null
		} satisfies AuditTrailData;
	} catch (cause) {
		/*
			Explained rather than thrown, following the rule the catalogue reader sets: a
			link that cannot be read is an empty state naming the cause and a logged
			failure, never a silent fallback and never a bare 500 — a 500 would tell an
			administrator nothing about which connection failed. There is no fallback to
			anything either: an empty trail is not evidence that nothing happened.
		*/
		console.error('[audit] could not read the command audit trail', { requested }, cause);

		return {
			rows: [],
			page: 1,
			pageSize: AUDIT_PAGE_SIZE,
			hasMore: false,
			unavailable: true,
			message: UNAVAILABLE_MESSAGE
		} satisfies AuditTrailData;
	}
}) satisfies PageServerLoad;

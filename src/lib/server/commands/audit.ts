import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { MAX_AUDIT_OUTPUT_CHARS, MAX_COMMAND_ARGUMENTS } from '$lib/gm-commands';
import { executeCommand, type SoapFailureReason, type SoapResult } from '$lib/server/acore';
import { getDb } from '$lib/server/db';
import { commandAudit } from '$lib/server/db/schema';

/**
 * The audit trail around a console command: the intent before it is sent, the
 * outcome after, and a row for every refusal.
 *
 * ## Why two writes and not one
 *
 * `acore_manager` and AzerothCore's databases cannot share a transaction, and
 * here the gap is not between two databases but **across the SOAP call**, which
 * can run for the client's ten-second timeout. Holding one MySQL transaction
 * open across it would pin a pool connection and hold locks for ten seconds to
 * protect nothing, so the write is two statements: `INSERT` the intent
 * (`pending`) *before* anything reaches the worldserver, then `UPDATE` that row
 * with the outcome. `executeCommand()` returns a discriminated result rather
 * than throwing, so the second statement sits on one uniform path and a failed
 * execution is recorded exactly like a successful one.
 *
 * A crash between the two leaves a `pending` row. That is the honest reading —
 * something was attempted and no outcome was recorded — and it is why the order
 * is not reversed: writing the outcome first would leave no evidence at all.
 *
 * ## What the failure paths do, and why they differ
 *
 * - **The intent insert fails ⇒ nothing is sent.** "No trail, no action": the
 *   worldserver's console is an administrator credential with arbitrary command
 *   execution behind it, so an action with no record is worse than an action
 *   that did not happen.
 * - **The outcome update fails ⇒ the command has already run.** There is no
 *   undo and no retry loop belongs inside a request, so the whole outcome goes
 *   to the log — the log becomes the fallback record — and the caller is told
 *   plainly that it ran and could not be recorded.
 * - **A refusal is its own row**, written before the caller's 403, because a
 *   moderator posting a command above their level is exactly the event worth
 *   having in the record. Unlike an action, a refusal does not depend on the
 *   trail being writable: refusing is safe either way, so a failed refusal
 *   insert is logged and the caller still refuses.
 *
 * ## The row builders are pure
 *
 * Everything below that is not a statement is a pure function taking its
 * timestamp and id as arguments, so the column values, the truncation and the
 * line that is sent can be tested without a database or a worldserver.
 */

/**
 * The statuses a row can hold.
 *
 * The column is a `varchar` rather than an enum on purpose: the reasons below
 * grow as the SOAP client learns about new failures, and adding an enum value
 * would be a DDL change on a table this project owns but should not have to
 * migrate for that.
 */
export type AuditStatus = 'pending' | 'success' | 'failed' | 'refused';

/**
 * `SoapFailureReason` plus the site's own refusal, which never reaches the
 * console. One vocabulary, so a trail row's reason and a SOAP result's reason
 * cannot drift into two spellings of the same thing.
 */
export type AuditFailureReason = SoapFailureReason | 'refused';

/** Who is acting, denormalised into the row at the moment of the attempt. */
export interface AuditActor {
	/** The acting profile. Intentionally **not** a foreign key — see `db/schema.ts`. */
	userId: string;
	/** The display name at the time, so the row survives a rename or a deletion. */
	name: string;
	/** The effective gmlevel the check actually used. */
	level: number;
}

/** What was asked for: the catalogue's own name, and the validated arguments. */
export interface AuditAttempt {
	/** The catalogue's name — never a line of text taken from a form. */
	command: string;
	/**
	 * The validated argument string, already trimmed, or `null` when the command
	 * takes none. `MAX_COMMAND_ARGUMENTS` is enforced before the attempt is
	 * recorded, so the row and the console line carry the same value.
	 */
	arguments: string | null;
}

/**
 * `target` is `varchar(64)` and the argument string may be longer, so the
 * convenience column is clamped; `arguments` stays the authority.
 */
const MAX_AUDIT_TARGET_CHARS = 64;

/** `message` is `varchar(512)`; an over-long value would be rejected and lose the row. */
const MAX_AUDIT_MESSAGE_CHARS = 512;

/**
 * A bound on the column rather than a substitute for validation.
 *
 * The runner refuses an argument string longer than `MAX_COMMAND_ARGUMENTS`
 * before anything is sent, so this never fires on the run path — it exists so
 * that no writer of this table can produce a row MySQL would reject outright,
 * which would lose the whole record rather than its tail.
 */
export function truncateArguments(value: string | null): string | null {
	return value === null ? null : value.slice(0, MAX_COMMAND_ARGUMENTS);
}

/**
 * Console output kept per row, **truncated** at the shared limit.
 *
 * A long reply loses its tail, so the column's documentation and the page that
 * shows it both name this limit rather than letting the text appear to end by
 * itself. An unbounded column is the worse answer: this is text of unknown size,
 * produced by a command, landing in a table that is never pruned.
 */
export function truncateOutput(value: string | null | undefined): string | null {
	return value == null ? null : value.slice(0, MAX_AUDIT_OUTPUT_CHARS);
}

/** The human-readable failure, clamped to its column for the reason above. */
export function truncateMessage(value: string): string {
	return value.slice(0, MAX_AUDIT_MESSAGE_CHARS);
}

/** The first argument, for search only. */
function targetOf(value: string | null): string | null {
	const [first = ''] = (value ?? '').trim().split(/\s+/, 1);

	return first === '' ? null : first.slice(0, MAX_AUDIT_TARGET_CHARS);
}

/**
 * The console line for one attempt: a dot, the catalogue's name, then the
 * validated arguments.
 *
 * Built here, beside the row it is recorded in, so the record and the wire
 * cannot disagree about what was sent. The name never comes from a form — it is
 * the catalogue's own, which is the whitelist.
 */
export function commandLineFor(attempt: AuditAttempt): string {
	const args = attempt.arguments?.trim() ?? '';

	return args === '' ? `.${attempt.command}` : `.${attempt.command} ${args}`;
}

/** Everything an intent row needs; the id and the timestamp are injected so the builder stays pure. */
export interface PendingAuditInput {
	/** Generated by the writer and reused for the outcome update. */
	id: string;
	actor: AuditActor;
	attempt: AuditAttempt;
	/** When the attempt was recorded. */
	at: Date;
}

/** The intent row, written **before** anything reaches the worldserver. */
export function pendingAuditRow(input: PendingAuditInput): typeof commandAudit.$inferInsert {
	const { id, actor, attempt, at } = input;

	return {
		id,
		userId: actor.userId,
		actorName: actor.name,
		actorLevel: actor.level,
		command: attempt.command,
		arguments: truncateArguments(attempt.arguments),
		target: targetOf(attempt.arguments),
		status: 'pending',
		createdAt: at
	};
}

/** A refusal: what was asked for and the sentence the operator is about to see. */
export interface RefusedAuditInput extends PendingAuditInput {
	/** The explanation shown to the operator, e.g. the catalogue entry's own note. */
	reason: string;
}

/** The refusal row, written **before** the caller's 403. */
export function refusedAuditRow(input: RefusedAuditInput): typeof commandAudit.$inferInsert {
	return {
		...pendingAuditRow(input),
		status: 'refused',
		failureReason: 'refused',
		message: truncateMessage(input.reason),
		// A refusal never reaches the console, so it is complete as written.
		finishedAt: input.at
	};
}

/** What the console did, and how long it took. */
export interface AuditOutcomeInput {
	result: SoapResult;
	/** Wall-clock time of the call — how a queue building up becomes visible. */
	durationMs: number;
	at: Date;
}

/** The columns the outcome update sets, on one path for success and failure alike. */
export function outcomeAuditRow(
	input: AuditOutcomeInput
): Partial<typeof commandAudit.$inferInsert> {
	const { result, durationMs, at } = input;

	return {
		status: result.ok ? 'success' : 'failed',
		failureReason: result.ok ? null : result.reason,
		message: result.ok ? null : truncateMessage(result.message),
		output: truncateOutput(result.output),
		durationMs,
		finishedAt: at
	};
}

/**
 * Records an attempt the site refused, before the caller refuses it too.
 *
 * Returns the row's id, or `null` when even the refusal could not be written.
 * A `null` is not a reason to let the request through: refusing is safe whether
 * or not it was recorded, so the caller still refuses and only the record is
 * missing.
 */
export async function recordRefusal(
	actor: AuditActor,
	attempt: AuditAttempt,
	reason: string
): Promise<string | null> {
	const id = randomUUID();

	try {
		await getDb()
			.insert(commandAudit)
			.values(refusedAuditRow({ id, actor, attempt, reason, at: new Date() }));

		return id;
	} catch (cause) {
		console.error(
			'[commands] refused a command but could not record the refusal; the refusal stands and only the record is missing',
			{ auditId: id, actor, attempt, reason },
			cause
		);

		return null;
	}
}

/**
 * Writes the outcome onto the row the intent insert created.
 *
 * Returns whether it was recorded instead of throwing: by the time this runs the
 * command has **already run**, so there is nothing left to refuse. When the write
 * fails the whole outcome goes to the log — the log becomes the fallback record —
 * and the caller reports the run as unrecorded rather than as a success.
 */
export async function finishAudit(
	auditId: string,
	result: SoapResult,
	durationMs: number
): Promise<boolean> {
	try {
		await getDb()
			.update(commandAudit)
			.set(outcomeAuditRow({ result, durationMs, at: new Date() }))
			.where(eq(commandAudit.id, auditId));

		return true;
	} catch (cause) {
		console.error(
			'[commands] the command ran but its outcome could not be recorded; this log entry is the only record of it',
			{ auditId, result, durationMs },
			cause
		);

		return false;
	}
}

/** One attempt, as the caller describes it. */
export interface AuditedRunInput {
	actor: AuditActor;
	attempt: AuditAttempt;
}

/**
 * The result of an attempt, whether or not it was sent.
 *
 * `recorded: false` is the case worth reading twice: the command reached the
 * worldserver and only the log holds its outcome.
 */
export type AuditedExecution =
	| { ran: true; auditId: string; result: SoapResult; recorded: boolean }
	| { ran: false; reason: 'audit-unavailable' | 'arguments-too-long'; message: string };

/**
 * Runs one catalogue command with the trail around it.
 *
 * This is the only place that sends a command, and it exists so the order in
 * `§6.1` of the design cannot be got wrong per call site: the intent row first,
 * the worldserver second, the outcome third. The policy checks that come before
 * it — is the command runnable at all, may this actor run it — stay with the
 * caller, because they produce their own `refused` rows and a 403 rather than an
 * execution.
 */
export async function runAuditedCommand(input: AuditedRunInput): Promise<AuditedExecution> {
	const { actor, attempt } = input;
	const args = attempt.arguments?.trim() ?? '';

	// An argument string this long is a caller mistake, not a hostile one: the
	// action caps it first. Refusing here keeps the recorded value and the line
	// that is sent identical rather than silently different.
	if (args.length > MAX_COMMAND_ARGUMENTS) {
		return {
			ran: false,
			reason: 'arguments-too-long',
			message: `Arguments may be at most ${MAX_COMMAND_ARGUMENTS} characters.`
		};
	}

	const auditAttempt: AuditAttempt = {
		command: attempt.command,
		arguments: args === '' ? null : args
	};
	const auditId = randomUUID();

	try {
		await getDb()
			.insert(commandAudit)
			.values(pendingAuditRow({ id: auditId, actor, attempt: auditAttempt, at: new Date() }));
	} catch (cause) {
		console.error(
			'[commands] could not write the audit intent, so nothing was sent to the worldserver',
			{ auditId, actor, attempt: auditAttempt },
			cause
		);

		return {
			ran: false,
			reason: 'audit-unavailable',
			message:
				'The audit trail is unavailable, so the command was not run. Nothing was sent to the server.'
		};
	}

	const startedAt = Date.now();
	const result = await executeCommand(commandLineFor(auditAttempt));
	const durationMs = Date.now() - startedAt;
	const recorded = await finishAudit(auditId, result, durationMs);

	return { ran: true, auditId, result, recorded };
}

/** How many rows the trail page shows at a time. */
export const AUDIT_PAGE_SIZE = 50;

/** One page of the trail, newest first. */
export interface AuditPage {
	rows: (typeof commandAudit.$inferSelect)[];
	page: number;
	pageSize: number;
	/** Whether a further page exists — known by reading one row more than the page. */
	hasMore: boolean;
}

/**
 * One page of audit rows, newest first.
 *
 * Paged rather than loaded whole, because the table is append-only and never
 * pruned. `hasMore` comes from reading one row beyond the page rather than from
 * a second `COUNT(*)`: one index-ordered scan answers both questions, and the
 * count would have to be repeated on every page anyway.
 */
export async function readAuditPage(page = 1, pageSize = AUDIT_PAGE_SIZE): Promise<AuditPage> {
	const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
	const safeSize = Number.isInteger(pageSize) && pageSize >= 1 ? pageSize : AUDIT_PAGE_SIZE;

	const rows = await getDb()
		.select()
		.from(commandAudit)
		.orderBy(desc(commandAudit.createdAt))
		.limit(safeSize + 1)
		.offset((safePage - 1) * safeSize);

	return {
		rows: rows.slice(0, safeSize),
		page: safePage,
		pageSize: safeSize,
		hasMore: rows.length > safeSize
	};
}

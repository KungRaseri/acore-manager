import type { Actions, PageServerLoad } from './$types';
import { error, fail, isHttpError } from '@sveltejs/kit';
import type { Access } from '$lib/access';
import { MAX_AUDIT_OUTPUT_CHARS, requiresConfirmation, type GmCommand } from '$lib/gm-commands';
import { findCommand, readCommandCatalogue } from '$lib/server/acore/commands';
import {
	recordRefusal,
	runAuditedCommand,
	truncateOutput,
	type AuditActor,
	type AuditAttempt
} from '$lib/server/commands/audit';
import { confirmationMatches, validateCommandArguments } from '$lib/server/commands/rules';
import { getAccess, requireCommandLevel, requireStaff } from '$lib/server/authz';

/**
 * The GM command console's server half: the catalogue the page lists, and the one
 * action that may send a command.
 *
 * ## The page contract
 *
 * `load` returns plain, JSON-serialisable data and nothing else — no class
 * instance and no server-side value — so the page can be written against it
 * without knowing how the realm was read:
 *
 * - `catalogue.available` — whether the realm's `command` table could be read at
 *   all, which is not the same thing as a table that read successfully and held
 *   nothing;
 * - `catalogue.message` — the sentence to show when there is nothing to list, or
 *   `null` when there are entries;
 * - `catalogue.entries` — the realm's rows, each with `runnable`, `risk` and the
 *   `note` that explains why the site will not run it;
 * - `access` — the acting visitor's own tier and gmlevel, which is what lets the
 *   page show a command above their level *disabled with the reason* rather than
 *   hiding it.
 *
 * The form posts to `?/run` with `command` (a catalogue name), `arguments`, and —
 * for a command whose risk requires it — `confirmation`, the command's name typed
 * out. The typed confirmation is compared **on the server**; the form's own guard
 * is a convenience, not the check.
 *
 * ## Why the action re-checks everything
 *
 * An action is not covered by a layout: SvelteKit runs it *before* the page's load
 * functions, so the 403 from the folder layout would arrive after the side effect
 * had already happened. Every check therefore happens inside the action, in the
 * order the design note fixes, and every refusal is written to the audit trail
 * before the response leaves — a moderator posting a command above their level is
 * exactly the event worth having in the record.
 *
 * ## Reading the realm's table for an access decision
 *
 * That is the question a reviewer should ask, and the answer is that it adds no
 * new consumer of untrusted data: the core adopts the same table's `security` as
 * each command's own required level (`ChatCommand.cpp:118-124`), so anyone who can
 * write to `command` can already change what the realm's commands demand.
 */

/**
 * The catalogue as the page lists it.
 *
 * `available: false` means the table could not be read — a broken link to
 * AzerothCore, worth explaining and worth researching. `available: true` with no
 * entries means the table was read and is empty, which is a property of that
 * realm. Both leave nothing runnable, and the difference is *why*: the page shows
 * a different sentence for each rather than blaming a connection for an import
 * that never happened.
 */
export interface CommandCatalogueView {
	available: boolean;
	/** The sentence the page shows instead of the list, or `null` when there are entries. */
	message: string | null;
	entries: GmCommand[];
}

/** The load's whole payload — plain and JSON-serialisable by construction. */
export interface CommandConsoleData {
	catalogue: CommandCatalogueView;
	/** The visitor's resolved access: the tier and the level the page badges commands with. */
	access: Access;
}

/*
	Written server-side so the same sentence reaches the browser and the log, and
	so the reader's two empty states survive into the UI. The second sentence can
	name the file because the table ships in AzerothCore's own base SQL.
*/
const UNAVAILABLE_MESSAGE =
	"The realm's command table could not be read, so nothing is listed and nothing can be run from here. Check ACORE_DATABASE_URL and the acore_world SELECT grant.";

const EMPTY_TABLE_MESSAGE =
	"The realm's command table is empty, so there is nothing to run. AzerothCore ships that table in data/sql/base/db_world/command.sql, so an empty one usually means the world database was imported without it.";

export const load = (async ({ locals }) => {
	/*
		Access and the catalogue are independent reads, so they go together. The
		level is memoised within the request, so this costs no second pair of
		queries, and reading the catalogue per request is deliberate: nothing
		about what the realm declares is cached.
	*/
	const [access, catalogue] = await Promise.all([getAccess(locals), readCommandCatalogue()]);

	/*
		`entries` is empty whenever the table could not be read, so "nothing is
		runnable" is true by construction rather than by a second check that could
		drift away from the reader's.
	*/
	const message =
		catalogue.entries.length > 0
			? null
			: catalogue.available
				? EMPTY_TABLE_MESSAGE
				: UNAVAILABLE_MESSAGE;

	const data: CommandConsoleData = {
		catalogue: { available: catalogue.available, message, entries: catalogue.entries },
		access
	};

	return data;
}) satisfies PageServerLoad;

/**
 * What the page renders after one attempt, whatever the outcome.
 *
 * One shape for success and failure alike, like `CheckResult` in
 * `staff/gm/+page.server.ts`, so the page shows the outcome in one block and
 * narrows nothing: `ok: false` covers a refusal the site made, a failure the
 * console reported, and a command that ran on the realm but could not be recorded.
 */
export interface CommandRunResult {
	ok: boolean;
	/** The sentence to show beside the outcome; `''` after a clean success. */
	message: string;
	/** The console's own reply, truncated to `MAX_AUDIT_OUTPUT_CHARS`. */
	output: string;
	/** Whether `output` lost its tail to the truncation limit. */
	truncated: boolean;
	/** The audit row this attempt produced, or `null` when none was written. */
	auditId: string | null;
	/**
	 * Whether the trail holds the outcome. `false` after a successful run means the
	 * command reached the realm and only the server's log records what happened —
	 * the page has to say so rather than showing an unqualified success.
	 */
	recorded: boolean;
}

/** One shape for every failure the action answers with, including the audited ones. */
function runFailure(message: string, auditId: string | null = null): CommandRunResult {
	return { ok: false, message, output: '', truncated: false, auditId, recorded: false };
}

export const actions = {
	run: async ({ locals, request }) => {
		/*
			1. Access, re-resolved inside the action. The layout's 403 would arrive
			only after this had already spent the site's administrator console
			credential, so this is the check that matters. `staff/gm/+page.server.ts`
			is the precedent, and it exists because the same hole was found once
			already.
		*/
		const access = await getAccess(locals);

		requireStaff(access);

		const actor = locals.user;

		if (!actor) {
			/*
				Unreachable: with no session `getAccess` reports a player, and the line
				above refuses one. Written as a guard rather than an assertion so a
				later change to that rule cannot turn this into a crash.
			*/
			error(403, 'The staff area is not open to this account.');
		}

		const acting: AuditActor = { userId: actor.id, name: actor.name, level: access.level };

		const data = await request.formData();
		const submittedName = String(data.get('command') ?? '');
		const submittedArguments = String(data.get('arguments') ?? '');
		const submittedConfirmation = String(data.get('confirmation') ?? '');

		/*
			2. The submitted value is a *name*, and it is only ever a lookup key. The
			console line is built from the catalogue entry's own name, so a name the
			realm does not list can never reach the console — that whitelist is what
			makes the form safe, and it fails closed.
		*/
		const catalogue = await readCommandCatalogue();

		if (!catalogue.available) {
			// Availability is checked before the lookup so a realm whose table cannot
			// be read is explained as that, rather than reported as an unknown command.
			error(
				503,
				'The command catalogue could not be read, so no command can be run. Nothing was sent to the server.'
			);
		}

		const command = findCommand(catalogue, submittedName);

		if (!command) {
			/*
				404, and no refusal row, following the design's order of operations: a
				row's `command` column holds a name the realm itself lists, and a name
				it does not list is not an attempt at one.
			*/
			error(404, "No such command in this realm's catalogue.");
		}

		/*
			The attempt as the trail records it. Arguments stay `null` until they have
			been validated: the row is not a place for a value this site has not yet
			agreed to send, and every refusal below happens before there is one.
		*/
		const attempt: AuditAttempt = { command: command.name, arguments: null };

		/*
			3. Policy first, because it is a property of the entry and not of the
			actor: level 0 (player self-service, which through the console credential
			would act on the console's own account), a level above the site's ladder,
			or an entry the overlay blocks. The refusal is written before the 403
			leaves — refusals are audited, never silent.
		*/
		if (!command.runnable) {
			const reason = command.note ?? 'This command cannot be run through this site.';

			await recordRefusal(acting, attempt, reason);
			error(403, reason);
		}

		/*
			4. The per-command level, from `authz`. The check is wrapped rather than
			re-implemented here, so the rule has exactly one home — and the refusal is
			recorded before the helper's own 403 propagates.
		*/
		try {
			requireCommandLevel(access, command.security);
		} catch (cause) {
			if (!isHttpError(cause, 403)) {
				throw cause;
			}

			await recordRefusal(acting, attempt, cause.body.message);
			throw cause;
		}

		/*
			5. The arguments and the confirmation, both validated on the server
			whatever the form did. A client-side guard is not a guard, so a forged
			POST that omits the confirmation is refused *and recorded* here rather
			than quietly ignored.
		*/
		const validated = validateCommandArguments(submittedArguments, command.syntax);

		if (!validated.ok) {
			const auditId = await recordRefusal(acting, attempt, validated.message);

			return fail(400, { run: runFailure(validated.message, auditId) });
		}

		const runAttempt: AuditAttempt = {
			command: command.name,
			arguments: validated.value === '' ? null : validated.value
		};

		if (
			requiresConfirmation(command.risk) &&
			!confirmationMatches(submittedConfirmation, command.name)
		) {
			const message = `Type the command's name — ${command.name} — to confirm it. Nothing was sent.`;

			// The arguments passed validation by now, so the refusal records them: the
			// row is still a faithful picture of what was asked for.
			const auditId = await recordRefusal(acting, runAttempt, message);

			return fail(400, { run: runFailure(message, auditId) });
		}

		/*
			6–8. The audited runner writes the intent row, sends the command and
			writes the outcome, in that order and in one place, so the ordering the
			design fixes cannot be got wrong here. It is the only thing that sends
			anything: this action never builds a console line itself.
		*/
		const execution = await runAuditedCommand({ actor: acting, attempt: runAttempt });

		if (!execution.ran) {
			if (execution.reason === 'audit-unavailable') {
				/*
					No trail, no action: nothing reached the worldserver, and the page must
					not suggest otherwise. A 503 rather than a 400 because the request was
					fine and the site's own records were not.
				*/
				error(503, execution.message);
			}

			// `arguments-too-long` is unreachable behind the check above; it is a caller
			// mistake either way, and nothing was sent.
			return fail(400, { run: runFailure(execution.message) });
		}

		const rawOutput = execution.result.output ?? '';

		/*
			9. Truncation is applied here as well as in the row, so the operator reads
			the same text the trail keeps — and `truncated` lets the page say the tail
			is missing rather than letting the reply appear to end by itself.
		*/
		return {
			run: {
				ok: execution.result.ok,
				message: execution.result.ok ? '' : execution.result.message,
				output: truncateOutput(rawOutput) ?? '',
				truncated: rawOutput.length > MAX_AUDIT_OUTPUT_CHARS,
				auditId: execution.auditId,
				recorded: execution.recorded
			} satisfies CommandRunResult
		};
	}
} satisfies Actions;

import { MAX_COMMAND_ARGUMENTS, syntaxDeclaresArguments } from '$lib/gm-commands';

/**
 * The rules an argument string and a typed confirmation must pass before a
 * command can reach the worldserver's console.
 *
 * ## Why the argument rule is strict
 *
 * The console is line-oriented and the server splits a command line on spaces,
 * which is the reasoning [`rules.ts`](src/lib/server/accounts/rules.ts) already
 * documents for `account create`: an argument containing a space silently arrives
 * as two arguments, and a line break ends the line and turns whatever follows into
 * a second command. The transport is not the place to fix that — `escapeXml` in
 * [`soap-protocol.ts`](src/lib/server/acore/soap-protocol.ts) makes a value safe
 * *for XML*, not for the console's own parser — so the value is refused here.
 *
 * The command's **name** is deliberately not validated here. It comes out of the
 * realm's own catalogue, which is the whitelist, and the line that is sent is
 * built from the entry's name rather than from anything a form submitted.
 *
 * ## Why these are pure, and why they live outside the route
 *
 * They decide what is sent and what is refused, so they are the part of the action
 * worth exercising without a database, a worldserver or a session — the same
 * reason the row builders in [`audit.ts`](src/lib/server/commands/audit.ts) take
 * their timestamp as an argument. Each one answers with a sentence as well as a
 * verdict, because that sentence is what the refused audit row records and what
 * the operator is shown.
 */

/** The shape [`rules.ts`](src/lib/server/accounts/rules.ts) uses for its own validators. */
export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Whether a value carries a control character.
 *
 * C0 (0x00–0x1F, which includes `\r`, `\n` and `\t`), DEL and C1 (0x7F–0x9F) are
 * refused. The ones that matter are the line break, which the console would read
 * as the end of this command and the start of another, and the tab, which its
 * tokenizer treats as whitespace — but the whole category is refused rather than
 * a list of three, so a character nobody here thought of cannot slip through.
 *
 * A scan rather than a pattern: a literal control character inside a regular
 * expression is exactly what ESLint's `no-control-regex` forbids, and that rule
 * is right — the range is clearer written as the numbers it is.
 */
function hasControlCharacter(value: string): boolean {
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;

		if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
			return true;
		}
	}

	return false;
}

/**
 * The argument string as it will be recorded and sent, or the sentence that
 * refuses it.
 *
 * Empty is legal: plenty of commands take no arguments, and the catalogue's own
 * syntax says which do. The rules, in the order they are applied:
 *
 * 1. **No control characters** — checked *before* the value is trimmed, so a
 *    trailing newline is rejected rather than quietly stripped away.
 * 2. **At most `MAX_COMMAND_ARGUMENTS` characters** — the cap the audit row
 *    enforces too, so the record and the wire carry the same value.
 * 3. **No arguments at all when the realm's syntax declares none.** The syntax is
 *    a hint, not a validation rule, so this refuses only the case the command
 *    cannot use; it never rejects an argument the realm would have accepted.
 */
export function validateCommandArguments(value: string, syntax: string): Validated<string> {
	if (hasControlCharacter(value)) {
		return {
			ok: false,
			message:
				'Arguments must be a single line: a line break, a tab or another control character would reach the console as a second command.'
		};
	}

	const supplied = value.trim();

	if (supplied.length > MAX_COMMAND_ARGUMENTS) {
		return {
			ok: false,
			message: `Arguments may be at most ${MAX_COMMAND_ARGUMENTS} characters.`
		};
	}

	if (supplied !== '' && !syntaxDeclaresArguments(syntax)) {
		return {
			ok: false,
			message:
				"The realm's own help text declares no arguments for this command, so the value was not sent."
		};
	}

	return { ok: true, value: supplied };
}

/**
 * Whether the typed confirmation is the command's own name.
 *
 * The expected value is the **catalogue's** name, which the server derived
 * itself, and comparing it here rather than trusting a "confirmed" boolean is the
 * whole point: a client-side guard is not a guard, and a forged POST that omits
 * the field is refused and recorded like any other refusal.
 *
 * Case and outer whitespace are ignored, matching how the catalogue folds a name
 * when it looks one up — the realm resolves `.Kick` and `.kick` alike — so making
 * a person match the realm's spelling exactly would refuse a deliberate
 * confirmation for a reason that carries no meaning. An empty value never
 * matches, so an omitted field cannot pass as a confirmation.
 */
export function confirmationMatches(typed: string, commandName: string): boolean {
	const typedName = typed.trim().toLowerCase();

	return typedName !== '' && typedName === commandName.trim().toLowerCase();
}

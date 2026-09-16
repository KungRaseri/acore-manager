/**
 * The AzerothCore SOAP wire format, with no transport and no environment access.
 *
 * Kept separate from `./soap` on purpose: this half is pure, so it can be unit
 * tested without a running worldserver or a configured environment.
 *
 * AzerothCore exposes exactly one SOAP operation, `executeCommand`, in the
 * `urn:AC` namespace (see `src/server/apps/worldserver/ACSoap/ACSoap.cpp` in the
 * core). The request carries a `<command>` and the response carries the captured
 * console output in `<result>`.
 *
 * A command that runs but **fails** comes back as a SOAP fault whose
 * `faultstring` is the console output — so callers must distinguish a fault
 * ("the command failed") from a transport or auth failure.
 */

const SOAP_ENV_NAMESPACE = 'http://schemas.xmlsoap.org/soap/envelope/';
const ACORE_NAMESPACE = 'urn:AC';
const OPERATION = 'executeCommand';

/**
 * The ampersand is built from its char code rather than written literally. The
 * entity strings in this file are the whole point of the module, and a literal
 * ampersand+name sequence in source is easy to mangle in transit.
 */
const AMP = String.fromCharCode(38);

/**
 * Matches an optional namespace prefix such as `ns1:` or `SOAP-ENV:`.
 *
 * Note the explicit character class rather than `\w`: the envelope prefix is
 * `SOAP-ENV`, and `\w` does not match a hyphen. Getting this wrong silently
 * failed to detect real faults.
 */
const OPTIONAL_PREFIX = '(?:[A-Za-z0-9_][\\w.-]*:)?';

export const SOAP_ACTION = `"${ACORE_NAMESPACE}#${OPERATION}"`;
export const SOAP_CONTENT_TYPE = 'text/xml; charset=utf-8';

const ESCAPE_MAP: Record<string, string> = {
	'&': `${AMP}amp;`,
	'<': `${AMP}lt;`,
	'>': `${AMP}gt;`,
	'"': `${AMP}quot;`,
	"'": `${AMP}apos;`
};

const NAMED_ENTITIES: Record<string, string> = {
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	amp: AMP
};

export function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ESCAPE_MAP[character]);
}

export function decodeXmlEntities(value: string): string {
	// Numeric references first. The named pass replaces in a single sweep and
	// never re-scans its own output, so a doubly escaped ampersand is not
	// decoded twice.
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => codePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, decimal: string) => codePoint(Number(decimal)))
		.replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function codePoint(value: number): string {
	return Number.isFinite(value) ? String.fromCodePoint(value) : '';
}

export function buildExecuteCommandEnvelope(command: string): string {
	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<SOAP-ENV:Envelope xmlns:SOAP-ENV="${SOAP_ENV_NAMESPACE}" xmlns:ns1="${ACORE_NAMESPACE}">` +
		`<SOAP-ENV:Body>` +
		`<ns1:${OPERATION}><command>${escapeXml(command)}</command></ns1:${OPERATION}>` +
		`</SOAP-ENV:Body>` +
		`</SOAP-ENV:Envelope>`
	);
}

export type SoapResponse =
	| { kind: 'result'; output: string }
	| { kind: 'fault'; faultString: string };

/**
 * Finds an element by local name, ignoring any namespace prefix, and returns its
 * text with CDATA unwrapped and entities decoded.
 */
function extractElement(xml: string, localName: string): string | null {
	const pattern = new RegExp(
		`<${OPTIONAL_PREFIX}${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</${OPTIONAL_PREFIX}${localName}>`
	);
	const match = pattern.exec(xml);

	if (!match) {
		return null;
	}

	const inner = match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');

	return decodeXmlEntities(inner);
}

/**
 * Returns `null` when the body is neither a result nor a fault, so the caller can
 * report a malformed response instead of guessing.
 */
export function parseExecuteCommandResponse(xml: string): SoapResponse | null {
	if (new RegExp(`<${OPTIONAL_PREFIX}Fault[\\s/>]`).test(xml)) {
		return { kind: 'fault', faultString: extractElement(xml, 'faultstring') ?? '' };
	}

	const output = extractElement(xml, 'result');

	return output === null ? null : { kind: 'result', output };
}

import { env } from '$env/dynamic/private';
import {
	SOAP_ACTION,
	SOAP_CONTENT_TYPE,
	buildExecuteCommandEnvelope,
	parseExecuteCommandResponse
} from './soap-protocol';

/**
 * Server-only SOAP client for the AzerothCore worldserver.
 *
 * ## Why this is server-only
 *
 * The credentials are an **administrator** account (the worldserver rejects
 * anything below `SEC_ADMINISTRATOR` with 403) and basic auth sends them on every
 * request. Exposing this to the browser would hand out admin credentials and
 * publish a port that must stay internal. Nothing here may be imported from
 * client-side code.
 *
 * ## Why calls are serialised
 *
 * The worldserver serves SOAP on a single thread, accepting and processing one
 * request at a time, and each command is queued onto the world thread where the
 * SOAP thread then blocks until it finishes. Concurrent calls would simply queue
 * up server-side, so they are queued here instead — one in flight, always.
 *
 * ## Why every call has a timeout
 *
 * There is no overall command timeout server-side: the handler polls once a
 * second and only gives up when the world is shutting down. A command that never
 * completes would otherwise hang the caller forever.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export type SoapFailureReason =
	| 'not-configured'
	| 'timeout'
	| 'unreachable'
	| 'unauthorized'
	| 'forbidden'
	| 'fault'
	| 'http-error'
	| 'malformed';

export type SoapResult =
	| { ok: true; output: string }
	| { ok: false; reason: SoapFailureReason; message: string; output?: string };

export interface SoapOptions {
	timeoutMs?: number;
}

/**
 * Serialises calls so only one SOAP request is ever in flight. The chain is kept
 * alive across failures, otherwise a single rejection would poison every later
 * call.
 */
let tail: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const result = tail.then(task, task);

	tail = result.catch(() => undefined);

	return result;
}

export function isSoapConfigured(): boolean {
	return Boolean(env.ACORE_SOAP_URL && env.ACORE_SOAP_USER && env.ACORE_SOAP_PASSWORD);
}

/**
 * Runs one console command through the worldserver's SOAP endpoint.
 *
 * Returns a discriminated result instead of throwing, because the failure modes
 * are meaningfully different: a `fault` means the command ran and failed (its
 * `output` is the console text), whereas `unauthorized`, `timeout` and
 * `unreachable` describe the connection itself.
 */
export function executeCommand(command: string, options: SoapOptions = {}): Promise<SoapResult> {
	const url = env.ACORE_SOAP_URL;
	const user = env.ACORE_SOAP_USER;
	const password = env.ACORE_SOAP_PASSWORD;

	if (!url || !user || !password) {
		return Promise.resolve({
			ok: false,
			reason: 'not-configured',
			message:
				'ACORE_SOAP_URL, ACORE_SOAP_USER and ACORE_SOAP_PASSWORD must all be set to use SOAP.'
		});
	}

	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

	return enqueue(async () => {
		let response: Response;

		try {
			response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': SOAP_CONTENT_TYPE,
					SOAPAction: SOAP_ACTION,
					Authorization: authorization
				},
				body: buildExecuteCommandEnvelope(command),
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === 'TimeoutError' || error.name === 'AbortError')
			) {
				return {
					ok: false,
					reason: 'timeout',
					message: `SOAP request timed out after ${timeoutMs}ms.`
				};
			}

			return {
				ok: false,
				reason: 'unreachable',
				message: `Could not reach the SOAP endpoint at ${url}.`
			};
		}

		const body = await response.text().catch(() => '');

		// Auth is checked before the command runs, so these are unambiguous.
		if (response.status === 401) {
			return {
				ok: false,
				reason: 'unauthorized',
				message: 'SOAP rejected the credentials (401). Check the account and password.'
			};
		}

		if (response.status === 403) {
			return {
				ok: false,
				reason: 'forbidden',
				message:
					'SOAP refused the account (403). It needs SEC_ADMINISTRATOR — `.account set gmlevel <user> 3 -1`.'
			};
		}

		// gsoap answers a SOAP fault with HTTP 500, so the body still has to be
		// parsed before treating the status as a transport failure.
		const parsed = parseExecuteCommandResponse(body);

		if (parsed?.kind === 'fault') {
			return {
				ok: false,
				reason: 'fault',
				message: parsed.faultString || 'The command failed.',
				output: parsed.faultString
			};
		}

		if (!response.ok) {
			return {
				ok: false,
				reason: 'http-error',
				message: `SOAP returned HTTP ${response.status}.`
			};
		}

		if (!parsed) {
			return {
				ok: false,
				reason: 'malformed',
				message: 'SOAP returned a response that was neither a result nor a fault.'
			};
		}

		return { ok: true, output: parsed.output };
	});
}

/**
 * Read-only connectivity check.
 *
 * Returns the raw console output on purpose — the response is plain console text,
 * so any structured reading of it is a parsing decision that belongs with the
 * feature that needs it, not here.
 */
export function getServerInfo(options: SoapOptions = {}): Promise<SoapResult> {
	return executeCommand('.server info', options);
}

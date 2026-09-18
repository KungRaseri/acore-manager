import { describe, expect, it } from 'vitest';
import { MAX_AUDIT_OUTPUT_CHARS, MAX_COMMAND_ARGUMENTS } from '$lib/gm-commands';
import {
	commandLineFor,
	outcomeAuditRow,
	pendingAuditRow,
	refusedAuditRow,
	truncateArguments,
	truncateOutput,
	type AuditActor
} from './audit';

/**
 * The pure half of the trail: the column values of each row, the truncation the
 * columns require, and the console line that is sent.
 *
 * The statements themselves are deliberately not tested here — they need a live
 * MySQL, and this repository configures no test database. What is pinned is
 * everything that can be got wrong without one: a missing `pending` row, a
 * refusal recorded as a success, a failure whose reason never reaches the row,
 * and output that grows past the column it is stored in.
 */

const ACTOR: AuditActor = { userId: 'profile-1', name: 'Bob', level: 3 };
const AT = new Date('2026-09-18T12:00:00.000Z');

describe('pendingAuditRow', () => {
	it('records the intent with the actor facts and the catalogue name', () => {
		expect(
			pendingAuditRow({
				id: 'audit-1',
				actor: ACTOR,
				attempt: { command: 'kick', arguments: 'Grommash no reason' },
				at: AT
			})
		).toEqual({
			id: 'audit-1',
			userId: 'profile-1',
			actorName: 'Bob',
			actorLevel: 3,
			command: 'kick',
			arguments: 'Grommash no reason',
			target: 'Grommash',
			status: 'pending',
			createdAt: AT
		});
	});

	it('leaves the outcome columns unset, because there is no outcome yet', () => {
		const row = pendingAuditRow({
			id: 'audit-1',
			actor: ACTOR,
			attempt: { command: 'server info', arguments: null },
			at: AT
		});

		expect(row.arguments).toBeNull();
		expect(row.target).toBeNull();
		expect(row.finishedAt).toBeUndefined();
		expect(row.failureReason).toBeUndefined();
	});

	it('clamps the argument string and the search target to their columns', () => {
		const longArguments = 'x'.repeat(MAX_COMMAND_ARGUMENTS + 50);
		const row = pendingAuditRow({
			id: 'audit-1',
			actor: ACTOR,
			attempt: { command: 'announce', arguments: longArguments },
			at: AT
		});

		expect(row.arguments).toHaveLength(MAX_COMMAND_ARGUMENTS);
		expect(row.target).toHaveLength(64);
	});
});

describe('refusedAuditRow', () => {
	it('writes a finished refusal rather than a pending attempt', () => {
		const row = refusedAuditRow({
			id: 'audit-2',
			actor: ACTOR,
			attempt: { command: 'server shutdown', arguments: '60' },
			reason: 'Takes the realm down, and this site has no way to bring it back up.',
			at: AT
		});

		expect(row).toEqual({
			id: 'audit-2',
			userId: 'profile-1',
			actorName: 'Bob',
			actorLevel: 3,
			command: 'server shutdown',
			arguments: '60',
			target: '60',
			status: 'refused',
			failureReason: 'refused',
			message: 'Takes the realm down, and this site has no way to bring it back up.',
			createdAt: AT,
			// A refusal never reaches the console, so it is complete as written.
			finishedAt: AT
		});
	});

	it('clamps the reason to the message column', () => {
		const row = refusedAuditRow({
			id: 'audit-2',
			actor: ACTOR,
			attempt: { command: 'kick', arguments: null },
			reason: 'y'.repeat(600),
			at: AT
		});

		expect(row.message).toHaveLength(512);
	});
});

describe('outcomeAuditRow', () => {
	it('records a success with the console output and the duration', () => {
		expect(
			outcomeAuditRow({
				result: { ok: true, output: 'Kicked Grommash.' },
				durationMs: 42,
				at: AT
			})
		).toEqual({
			status: 'success',
			failureReason: null,
			message: null,
			output: 'Kicked Grommash.',
			durationMs: 42,
			finishedAt: AT
		});
	});

	it('records a failure with its reason, and the console output when there is one', () => {
		// A `fault` is a command that ran and failed, so its output is the console's
		// own words; the connection failures carry none.
		expect(
			outcomeAuditRow({
				result: {
					ok: false,
					reason: 'fault',
					message: 'There is no such command.',
					output: 'There is no such command.'
				},
				durationMs: 3000,
				at: AT
			})
		).toEqual({
			status: 'failed',
			failureReason: 'fault',
			message: 'There is no such command.',
			output: 'There is no such command.',
			durationMs: 3000,
			finishedAt: AT
		});

		expect(
			outcomeAuditRow({
				result: { ok: false, reason: 'unreachable', message: 'Could not reach the endpoint.' },
				durationMs: 10_000,
				at: AT
			}).output
		).toBeNull();
	});

	it('clamps the output and the failure message to their columns', () => {
		const row = outcomeAuditRow({
			result: {
				ok: false,
				reason: 'http-error',
				message: 'z'.repeat(900),
				output: 'y'.repeat(MAX_AUDIT_OUTPUT_CHARS + 500)
			},
			durationMs: 5,
			at: AT
		});

		expect(row.output).toHaveLength(MAX_AUDIT_OUTPUT_CHARS);
		expect(row.message).toHaveLength(512);
	});
});

describe('commandLineFor', () => {
	it('prefixes the catalogue name with a dot, and appends the arguments', () => {
		expect(commandLineFor({ command: 'kick', arguments: 'Grommash no reason' })).toBe(
			'.kick Grommash no reason'
		);
	});

	it('sends the bare name when the command takes no arguments', () => {
		// The line is built from the catalogue's name, never from the form: the
		// catalogue is the whitelist, so the name cannot be a command of its own.
		expect(commandLineFor({ command: 'server info', arguments: null })).toBe('.server info');
		expect(commandLineFor({ command: 'server info', arguments: '' })).toBe('.server info');
		expect(commandLineFor({ command: 'kick', arguments: '   ' })).toBe('.kick');
	});
});

describe('the truncation helpers', () => {
	it('leave a short value alone and pass a missing one through as null', () => {
		expect(truncateArguments('Bob')).toBe('Bob');
		expect(truncateArguments(null)).toBeNull();
		expect(truncateOutput('OK')).toBe('OK');
		expect(truncateOutput(undefined)).toBeNull();
	});
});

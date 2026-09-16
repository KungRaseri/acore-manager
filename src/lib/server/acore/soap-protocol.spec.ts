import { describe, expect, it } from 'vitest';
import {
	buildExecuteCommandEnvelope,
	decodeXmlEntities,
	escapeXml,
	parseExecuteCommandResponse
} from './soap-protocol';

/** Built from a char code so the entity literals below survive intact. */
const AMP = String.fromCharCode(38);

describe('escapeXml', () => {
	it('escapes every XML metacharacter', () => {
		const escaped = escapeXml(`<a href="x">'&'</a>`);

		expect(escaped).toContain(`${AMP}lt;`);
		expect(escaped).toContain(`${AMP}gt;`);
		expect(escaped).toContain(`${AMP}quot;`);
		expect(escaped).toContain(`${AMP}apos;`);
		expect(escaped).toContain(`${AMP}amp;`);
		expect(escaped).not.toContain('<');
		expect(escaped).not.toContain('>');
		expect(escaped).not.toContain('"');
		expect(escaped).not.toContain("'");
	});

	it('round-trips through decodeXmlEntities', () => {
		const original = `<command attr="v">'&' and more</command>`;

		expect(decodeXmlEntities(escapeXml(original))).toBe(original);
	});
});

describe('buildExecuteCommandEnvelope', () => {
	it('uses the urn:AC namespace and the executeCommand operation', () => {
		const envelope = buildExecuteCommandEnvelope('.server info');

		expect(envelope).toContain('xmlns:ns1="urn:AC"');
		expect(envelope).toContain('<ns1:executeCommand>');
		expect(envelope).toContain('<command>.server info</command>');
	});

	it('escapes the command instead of injecting it', () => {
		const envelope = buildExecuteCommandEnvelope('.send items "Bob" & <script>');

		expect(envelope).not.toContain('<script>');
		expect(envelope).toContain(`${AMP}lt;script${AMP}gt;`);
		expect(envelope).toContain(`${AMP}amp;`);
	});
});

describe('parseExecuteCommandResponse', () => {
	it('reads the console output from a successful result', () => {
		const xml =
			'<SOAP-ENV:Body><ns1:executeCommandResponse>' +
			'<result>AzerothCore rev. 1234</result>' +
			'</ns1:executeCommandResponse></SOAP-ENV:Body>';

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'result',
			output: 'AzerothCore rev. 1234'
		});
	});

	it('preserves multi-line console output', () => {
		const xml = '<result>line one\nline two\nline three</result>';

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'result',
			output: 'line one\nline two\nline three'
		});
	});

	it('unwraps CDATA', () => {
		const xml = '<ns1:result><![CDATA[Some text and a bare & here]]></ns1:result>';

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'result',
			output: 'Some text and a bare & here'
		});
	});

	it('decodes entities in the output', () => {
		const xml = `<result>a ${AMP}lt;b${AMP}gt; ${AMP}amp; c</result>`;

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'result',
			output: 'a <b> & c'
		});
	});

	it('does not decode a doubly escaped ampersand twice', () => {
		const xml = `<result>${AMP}amp;lt;</result>`;

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'result',
			output: `${AMP}lt;`
		});
	});

	it('treats an empty result element as success with empty output', () => {
		expect(parseExecuteCommandResponse('<result></result>')).toEqual({
			kind: 'result',
			output: ''
		});
	});

	it('reports a fault with its console text, which is how a failed command arrives', () => {
		const xml =
			'<SOAP-ENV:Fault><faultcode>SOAP-ENV:Client</faultcode>' +
			'<faultstring>There is no such command</faultstring></SOAP-ENV:Fault>';

		expect(parseExecuteCommandResponse(xml)).toEqual({
			kind: 'fault',
			faultString: 'There is no such command'
		});
	});

	it('reports a fault with empty text rather than guessing', () => {
		const xml = '<SOAP-ENV:Fault><faultcode>SOAP-ENV:Client</faultcode></SOAP-ENV:Fault>';

		expect(parseExecuteCommandResponse(xml)).toEqual({ kind: 'fault', faultString: '' });
	});

	it('returns null for a body that is neither a result nor a fault', () => {
		expect(parseExecuteCommandResponse('<html><body>Not SOAP</body></html>')).toBeNull();
	});
});

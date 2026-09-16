export { executeCommand, getServerInfo, isSoapConfigured } from './soap';
export type { SoapFailureReason, SoapOptions, SoapResult } from './soap';
export {
	SOAP_ACTION,
	buildExecuteCommandEnvelope,
	decodeXmlEntities,
	escapeXml,
	parseExecuteCommandResponse
} from './soap-protocol';
export type { SoapResponse } from './soap-protocol';

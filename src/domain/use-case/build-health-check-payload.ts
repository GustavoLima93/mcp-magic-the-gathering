import type { HealthCheckPayload } from '../entity/models/health-check';

export interface BuildHealthCheckPayloadInput {
	serverName: string;
	version: string;
	timestamp: Date;
	uptimeSeconds: number;
}

export const buildHealthCheckPayload = (
	input: BuildHealthCheckPayloadInput,
): HealthCheckPayload => {
	return {
		status: 'ok',
		serverName: input.serverName,
		version: input.version,
		timestamp: input.timestamp.toISOString(),
		uptimeSeconds: input.uptimeSeconds,
	};
};

import type { ToolController } from '@/application/types';
import { buildHealthCheckPayload } from '@/domain/use-case/build-health-check-payload';

export interface CreateHealthCheckControllerInput {
	serverName: string;
	version: string;
	now?: () => Date;
	uptimeSeconds?: () => number;
}

export const createHealthCheckController = (
	input: CreateHealthCheckControllerInput,
): ToolController => {
	const now = input.now ?? (() => new Date());
	const uptimeSeconds =
		input.uptimeSeconds ?? (() => Math.floor(process.uptime()));

	return async () => {
		const payload = buildHealthCheckPayload({
			serverName: input.serverName,
			version: input.version,
			timestamp: now(),
			uptimeSeconds: uptimeSeconds(),
		});

		return {
			structuredContent: payload,
			content: [
				{
					type: 'text',
					text: JSON.stringify(payload),
				},
			],
		};
	};
};

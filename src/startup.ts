import { env } from '@/infra/env';
import { app } from '@/infra/http/app';
import { logger } from './infra/log';

app
	.listen({
		host: env.HOST,
		port: env.PORT,
	})
	.then(() => {
		logger.info(
			{
				host: env.HOST,
				port: env.PORT,
				mcpServerName: env.MCP_SERVER_NAME,
				mcpServerVersion: env.MCP_SERVER_VERSION,
				mcpSsePath: env.MCP_SSE_PATH,
				mcpMessagesPath: env.MCP_MESSAGES_PATH,
			},
			'MCP Fastify server started',
		);
	})
	.catch((err) => {
		logger.error(
			{ err },
			`Failed to start MCP Fastify server: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	});

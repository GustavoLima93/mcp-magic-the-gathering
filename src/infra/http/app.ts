import Fastify from 'fastify';
import { createHealthCheckController } from '@/application/controller/health-check-controller';
import { logger } from '@/infra/log';
import { env } from '../env';
import { handleMcpRequest } from './middleware/mcp-request';
import { server } from './server';

server.setTool(
	'health_check',
	'Returns local process health and MCP server metadata.',
	createHealthCheckController({
		serverName: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
);

export const app = Fastify({ loggerInstance: logger });

app.get(env.MCP_MESSAGES_PATH, handleMcpRequest);
app.post(env.MCP_MESSAGES_PATH, handleMcpRequest);
app.delete(env.MCP_MESSAGES_PATH, handleMcpRequest);

app.get(env.MCP_SSE_PATH, handleMcpRequest);
app.post(env.MCP_SSE_PATH, handleMcpRequest);
app.delete(env.MCP_SSE_PATH, handleMcpRequest);

app.addHook('onClose', async () => {
	const sessionIds = [...server.getSessions().keys()];
	await Promise.all(
		sessionIds.map((sessionId) => server.closeSession(sessionId)),
	);
});

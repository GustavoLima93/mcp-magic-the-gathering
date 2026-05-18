import Fastify from 'fastify';

import { createHealthCheckController } from '@/application/controller/health-check-controller';
import { createSearchCardsController } from '@/application/controller/search-cards-controller';

import { env } from '@/infra/env';
import { handleMcpRequest } from '@/infra/http/middleware/mcp-request';
import { searchCardsInputSchema } from '@/infra/http/request/search-card-input';
import { server } from '@/infra/http/server';
import { logger } from '@/infra/log';

server.setTool(
	'health_check',
	'Returns local process health and MCP server metadata.',
	createHealthCheckController({
		serverName: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
);

server.setTool(
	'search_cards',
	'Searches Magic: The Gathering cards with Scryfall fulltext syntax. Defaults to compact JSON List results in structuredContent; set format=csv to return Scryfall CSV as text content.',
	searchCardsInputSchema,
	createSearchCardsController(),
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

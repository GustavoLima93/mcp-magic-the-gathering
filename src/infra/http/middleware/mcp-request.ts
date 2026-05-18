import type { FastifyReply, FastifyRequest } from 'fastify';
import { isInitializeRequest, server } from '@/infra/http/server';
import { logger } from '@/infra/log';

const resolveSessionId = (
	sessionIdHeader: string | string[] | undefined,
): string | undefined => {
	return Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
};

export const handleMcpRequest = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const sessionId = resolveSessionId(request.headers['mcp-session-id']);

	const session =
		(sessionId && server.getSessions().get(sessionId)) || undefined;

	const parsedBody = (request.method === 'POST' && request.body) || undefined;

	try {
		if (session) {
			await session.transport.handleRequest(request.raw, reply.raw, parsedBody);
			return;
		}

		if (request.method === 'POST' && isInitializeRequest(request.body)) {
			const transport = await server.createTransportSession();
			await transport.handleRequest(request.raw, reply.raw, parsedBody);
			return;
		}

		reply.code(400).send({
			error:
				'Bad Request: missing/invalid MCP session or non-initialize MCP request',
		});
	} catch (error) {
		logger.error(
			{
				err: error,
				sessionId,
				method: request.method,
				path: request.url,
			},
			'Failed to process MCP Streamable HTTP request',
		);

		if (!reply.raw.headersSent) {
			reply.code(500).send({ error: 'Failed to process MCP request' });
		}
	}
};

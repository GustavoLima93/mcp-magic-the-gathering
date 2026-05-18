import { randomUUID } from 'node:crypto';
import {
	McpServer,
	type ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import type {
	AnySchema,
	ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { env } from '@/infra/env';
import { type Logger, logger } from '@/infra/log';

interface SessionContext {
	server: McpServer;
	transport: StreamableHTTPServerTransport;
}

class Server {
	private readonly server: McpServer;
	private readonly sessions = new Map<string, SessionContext>();
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
		this.server = this.createMcpServer();
	}

	private createMcpServer(): McpServer {
		const server = new McpServer({
			name: env.MCP_SERVER_NAME,
			version: env.MCP_SERVER_VERSION,
		});

		return server;
	}

	public async closeSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);

		if (!session) {
			return;
		}

		this.sessions.delete(sessionId);

		const [transport, server] = await Promise.allSettled([
			session.transport.close(),
			session.server.close(),
		]);

		transport.status === 'rejected' &&
			this.logger.warn({
				error: transport.reason,
				sessionError: sessionId,
				messageError: 'Failed to close MCP transport resource',
			});

		server.status === 'rejected' &&
			this.logger.warn({
				error: server.reason,
				sessionError: sessionId,
				messageError: 'Failed to close MCP server resource',
			});
	}

	public async createTransportSession(): Promise<StreamableHTTPServerTransport> {
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => randomUUID(),
			onsessioninitialized: (sessionId) => {
				this.sessions.set(sessionId, {
					server: this.server,
					transport,
				});
			},
		});

		transport.onclose = async () => {
			const sessionId = transport.sessionId;
			if (sessionId) {
				await this.closeSession(sessionId);
			}
		};

		try {
			await this.server.connect(transport as unknown as Transport);
		} catch (error) {
			this.logger.error(
				{
					error,
					message: 'Failed to connect new MCP transport session',
				},
				'Error during MCP transport session creation',
			);
			throw error;
		}

		return transport;
	}

	public getSessions(): Map<string, SessionContext> {
		return this.sessions;
	}

	public setTool(
		toolName: string,
		description: string,
		handler: ToolCallback,
	): void;

	public setTool<InputArgs extends ZodRawShapeCompat | AnySchema>(
		toolName: string,
		description: string,
		inputSchema: InputArgs,
		handler: ToolCallback<InputArgs>,
	): void;

	public setTool<InputArgs extends ZodRawShapeCompat | AnySchema>(
		toolName: string,
		description: string,
		inputSchemaOrHandler: InputArgs | ToolCallback,
		handler?: ToolCallback<InputArgs>,
	): void {
		if (typeof inputSchemaOrHandler === 'function') {
			this.server.registerTool(toolName, { description }, inputSchemaOrHandler);
			return;
		}

		if (!handler) {
			throw new Error(`Handler is required for tool ${toolName}`);
		}

		this.server.registerTool(
			toolName,
			{
				description,
				inputSchema: inputSchemaOrHandler,
			},
			handler,
		);
	}
}

const server = new Server(logger);

export { isInitializeRequest, server };

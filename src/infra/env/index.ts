import 'dotenv/config';

import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z
			.enum(['development', 'test', 'production'])
			.default('development'),
		HOST: z.string().trim().min(1).default('0.0.0.0'),
		PORT: z.coerce.number().int().min(1).max(65535).default(3000),
		MCP_SERVER_NAME: z.string().trim().min(1).default('mcp-node'),
		MCP_SERVER_VERSION: z.string().trim().min(1).default('0.1.0'),
		MCP_MESSAGES_PATH: z
			.string()
			.trim()
			.min(1)
			.default('/mcp/messages')
			.refine(
				(path) => path.startsWith('/'),
				"MCP_MESSAGES_PATH must start with '/'",
			),
		MCP_SSE_PATH: z
			.string()
			.trim()
			.min(1)
			.default('/mcp/sse')
			.refine(
				(path) => path.startsWith('/'),
				"MCP_SSE_PATH must start with '/'",
			),
		SCRYFALL_API_BASE_URL: z.url().trim().default('https://api.scryfall.com'),
		SCRYFALL_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1).default(10000),
	})
	.refine((env) => env.MCP_MESSAGES_PATH !== env.MCP_SSE_PATH, {
		path: ['MCP_SSE_PATH'],
		message: 'MCP_SSE_PATH must be different from MCP_MESSAGES_PATH',
	});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error('Invalid environment variables', _env.error.format());

	throw new Error('Invalid environment variables');
}

export const env = _env.data;

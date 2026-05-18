import type { CardSearchFormat } from '@/domain/entity/models/card-search';

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface ScryfallHttpClientInput {
	baseUrl: string;
	timeoutMs: number;
	fetch?: Fetch;
}

export interface ScryfallHttpClientGetInput {
	path: string;
	searchParams: URLSearchParams;
	format: CardSearchFormat;
}

export interface ScryfallHttpResponse {
	ok: boolean;
	status: number;
	url: string;
	body: unknown;
}

export type ScryfallHttpRequestFailureReason = 'network' | 'timeout';

export class ScryfallHttpRequestError extends Error {
	public readonly reason: ScryfallHttpRequestFailureReason;

	constructor(reason: ScryfallHttpRequestFailureReason) {
		super(
			reason === 'timeout'
				? 'Scryfall request timed out.'
				: 'Scryfall request failed.',
		);
		this.name = 'ScryfallHttpRequestError';
		this.reason = reason;
	}
}

export class ScryfallHttpPayloadError extends Error {
	constructor(message = 'Scryfall returned malformed JSON.') {
		super(message);
		this.name = 'ScryfallHttpPayloadError';
	}
}

export class ScryfallHttpClient {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly fetch: Fetch;

	constructor(input: ScryfallHttpClientInput) {
		this.baseUrl = input.baseUrl;
		this.timeoutMs = input.timeoutMs;
		this.fetch = input.fetch ?? fetch;
	}

	public async get(
		input: ScryfallHttpClientGetInput,
	): Promise<ScryfallHttpResponse> {
		const url = new URL(input.path, this.baseUrl);
		url.search = input.searchParams.toString();

		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, this.timeoutMs);

		try {
			const response = await this.fetch(url, {
				method: 'GET',
				headers: {
					Accept: this.buildAcceptHeader(input.format),
					'User-Agent': 'mcp-node/1.0 Scryfall client',
				},
				signal: controller.signal,
			});

			return {
				ok: response.ok,
				status: response.status,
				url: response.url || url.toString(),
				body: await this.decodeResponseBody(response, input.format),
			};
		} catch (error) {
			if (error instanceof ScryfallHttpPayloadError) {
				throw error;
			}

			if (error instanceof Error && error.name === 'AbortError') {
				throw new ScryfallHttpRequestError('timeout');
			}

			throw new ScryfallHttpRequestError('network');
		} finally {
			clearTimeout(timeout);
		}
	}

	private buildAcceptHeader(format: CardSearchFormat): string {
		if (format === 'csv') {
			return 'text/csv;q=0.9,*/*;q=0.8';
		}

		return 'application/json;q=0.9,*/*;q=0.8';
	}

	private async decodeResponseBody(
		response: Response,
		format: CardSearchFormat,
	): Promise<unknown> {
		const text = await response.text();

		if (format === 'csv') {
			return text;
		}

		try {
			return JSON.parse(text) as unknown;
		} catch {
			throw new ScryfallHttpPayloadError();
		}
	}
}

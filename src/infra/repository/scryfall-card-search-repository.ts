import type {
	CompactCard,
	CompactCardImageUris,
	SearchCardsRepositoryInput,
	SearchCardsResult,
} from '@/domain/entity/models/card-search';
import type { CardSearchRepository } from '@/domain/repository/card-search-repository';
import {
	type SearchCardsErrorDetails,
	SearchCardsMalformedPayloadError,
	SearchCardsUnavailableError,
	SearchCardsUpstreamError,
} from '@/domain/use-case/error/search-cards-error';
import {
	type ScryfallHttpClient,
	type ScryfallHttpClientGetInput,
	ScryfallHttpPayloadError,
	ScryfallHttpRequestError,
	type ScryfallHttpResponse,
} from '@/infra/client/scryfall/scryfall-http-client';
import {
	ScryfallRateLimiter,
	type ScryfallRateLimiterPort,
} from '@/infra/client/scryfall/scryfall-rate-limiter';

export interface ScryfallHttpClientPort {
	get(input: ScryfallHttpClientGetInput): Promise<ScryfallHttpResponse>;
}

type ScryfallCardSearchHttpClient = ScryfallHttpClient | ScryfallHttpClientPort;

export class ScryfallCardSearchRepository implements CardSearchRepository {
	constructor(
		private readonly httpClient: ScryfallCardSearchHttpClient,
		private readonly rateLimiter: ScryfallRateLimiterPort = new ScryfallRateLimiter(),
	) {}

	public async search(
		input: SearchCardsRepositoryInput,
	): Promise<SearchCardsResult> {
		const searchParams = this.buildSearchParams(input);
		const response = await this.sendRequest(input, searchParams);

		if (!response.ok) {
			throw this.toUpstreamError(response);
		}

		if (input.format === 'csv') {
			if (typeof response.body !== 'string') {
				throw new SearchCardsMalformedPayloadError();
			}

			return {
				format: 'csv',
				query: input.q,
				page: input.page,
				csv: response.body,
			};
		}

		return this.toJsonResult(response.body, input);
	}

	private buildSearchParams(
		input: SearchCardsRepositoryInput,
	): URLSearchParams {
		const searchParams = new URLSearchParams();

		searchParams.set('q', input.q);
		searchParams.set('unique', input.unique);
		searchParams.set('order', input.order);
		searchParams.set('dir', input.dir);
		searchParams.set('include_extras', String(input.includeExtras));
		searchParams.set('include_multilingual', String(input.includeMultilingual));
		searchParams.set('include_variations', String(input.includeVariations));
		searchParams.set('page', String(input.page));
		searchParams.set('format', input.format);
		searchParams.set('pretty', String(input.pretty));

		return searchParams;
	}

	private async sendRequest(
		input: SearchCardsRepositoryInput,
		searchParams: URLSearchParams,
	): Promise<ScryfallHttpResponse> {
		try {
			await this.rateLimiter.waitTurn();

			return await this.httpClient.get({
				path: '/cards/search',
				searchParams,
				format: input.format,
			});
		} catch (error) {
			if (error instanceof ScryfallHttpRequestError) {
				throw new SearchCardsUnavailableError();
			}

			if (error instanceof ScryfallHttpPayloadError) {
				throw new SearchCardsMalformedPayloadError();
			}

			throw error;
		}
	}

	private toJsonResult(
		body: unknown,
		input: SearchCardsRepositoryInput,
	): SearchCardsResult {
		if (!isRecord(body) || body.object !== 'list') {
			throw new SearchCardsMalformedPayloadError();
		}

		const totalCards = body.total_cards;
		const hasMore = body.has_more;
		const data = body.data;

		if (
			typeof totalCards !== 'number' ||
			typeof hasMore !== 'boolean' ||
			!Array.isArray(data)
		) {
			throw new SearchCardsMalformedPayloadError();
		}

		const result = {
			format: 'json' as const,
			query: input.q,
			page: input.page,
			object: 'list' as const,
			totalCards,
			hasMore,
			data: data.map((card) => this.toCompactCard(card)),
		};

		if (typeof body.next_page === 'string') {
			return {
				...result,
				nextPage: body.next_page,
				...this.toWarnings(body.warnings),
			};
		}

		return {
			...result,
			...this.toWarnings(body.warnings),
		};
	}

	private toCompactCard(card: unknown): CompactCard {
		if (!isRecord(card)) {
			throw new SearchCardsMalformedPayloadError();
		}

		const id = getString(card.id);
		const name = getString(card.name);

		if (!id || !name) {
			throw new SearchCardsMalformedPayloadError();
		}

		const compactCard: CompactCard = {
			id,
			name,
		};

		assignString(compactCard, 'manaCost', getCardTextField(card, 'mana_cost'));
		assignString(compactCard, 'typeLine', getCardTextField(card, 'type_line'));
		assignString(
			compactCard,
			'oracleText',
			getCardTextField(card, 'oracle_text'),
		);
		assignStringArray(compactCard, 'colors', card.colors);
		assignStringArray(compactCard, 'colorIdentity', card.color_identity);
		assignStringRecord(compactCard, 'legalities', card.legalities);
		assignString(compactCard, 'releasedAt', getString(card.released_at));
		assignString(compactCard, 'set', getString(card.set));
		assignString(compactCard, 'setName', getString(card.set_name));
		assignString(
			compactCard,
			'collectorNumber',
			getString(card.collector_number),
		);
		assignString(compactCard, 'rarity', getString(card.rarity));
		assignString(compactCard, 'scryfallUri', getString(card.scryfall_uri));

		const imageUris = toCompactImageUris(card.image_uris);

		if (imageUris) {
			compactCard.imageUris = imageUris;
		}

		return compactCard;
	}

	private toWarnings(warnings: unknown): { warnings?: string[] } {
		const parsedWarnings = toStringArray(warnings);

		if (!parsedWarnings) {
			return {};
		}

		return {
			warnings: parsedWarnings,
		};
	}

	private toUpstreamError(
		response: ScryfallHttpResponse,
	): SearchCardsUpstreamError {
		const scryfallError = parseScryfallError(response.body);
		const details: SearchCardsErrorDetails = {
			status: response.status,
		};

		if (scryfallError.code) {
			details.upstreamCode = scryfallError.code;
		}

		return new SearchCardsUpstreamError(
			scryfallError.message ||
				`Scryfall search request failed with status ${response.status}.`,
			details,
		);
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getString = (value: unknown): string | undefined => {
	return typeof value === 'string' ? value : undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
	if (
		!Array.isArray(value) ||
		!value.every((item) => typeof item === 'string')
	) {
		return undefined;
	}

	return value;
};

const getCardTextField = (
	card: Record<string, unknown>,
	fieldName: string,
): string | undefined => {
	const directValue = getString(card[fieldName]);

	if (directValue) {
		return directValue;
	}

	if (!Array.isArray(card.card_faces)) {
		return undefined;
	}

	const faceValues = card.card_faces
		.map((face) => {
			return isRecord(face) ? getString(face[fieldName]) : undefined;
		})
		.filter((value): value is string => Boolean(value));

	if (faceValues.length === 0) {
		return undefined;
	}

	return faceValues.join(' // ');
};

const assignString = <K extends keyof CompactCard>(
	target: CompactCard,
	key: K,
	value: string | undefined,
): void => {
	if (value !== undefined) {
		target[key] = value as CompactCard[K];
	}
};

const assignStringArray = <K extends keyof CompactCard>(
	target: CompactCard,
	key: K,
	value: unknown,
): void => {
	const strings = toStringArray(value);

	if (strings !== undefined) {
		target[key] = strings as CompactCard[K];
	}
};

const assignStringRecord = <K extends keyof CompactCard>(
	target: CompactCard,
	key: K,
	value: unknown,
): void => {
	if (!isRecord(value)) {
		return;
	}

	const entries = Object.entries(value);

	if (!entries.every(([, entryValue]) => typeof entryValue === 'string')) {
		return;
	}

	target[key] = Object.fromEntries(entries) as CompactCard[K];
};

const toCompactImageUris = (
	value: unknown,
): CompactCardImageUris | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const imageUris: CompactCardImageUris = {};

	assignImageUri(imageUris, 'small', value.small);
	assignImageUri(imageUris, 'normal', value.normal);
	assignImageUri(imageUris, 'large', value.large);
	assignImageUri(imageUris, 'png', value.png);
	assignImageUri(imageUris, 'artCrop', value.art_crop);
	assignImageUri(imageUris, 'borderCrop', value.border_crop);

	return Object.keys(imageUris).length > 0 ? imageUris : undefined;
};

const assignImageUri = <K extends keyof CompactCardImageUris>(
	target: CompactCardImageUris,
	key: K,
	value: unknown,
): void => {
	if (typeof value === 'string') {
		target[key] = value as CompactCardImageUris[K];
	}
};

const parseScryfallError = (
	body: unknown,
): { message?: string; code?: string } => {
	const parsedBody = typeof body === 'string' ? parseJsonBody(body) : body;

	if (!isRecord(parsedBody) || parsedBody.object !== 'error') {
		return {};
	}

	const details = getString(parsedBody.details);
	const message = getString(parsedBody.message);
	const code = getString(parsedBody.code);
	const result: { message?: string; code?: string } = {};
	const errorMessage = details ?? message;

	if (errorMessage) {
		result.message = errorMessage;
	}

	if (code) {
		result.code = code;
	}

	return result;
};

const parseJsonBody = (body: string): unknown => {
	try {
		return JSON.parse(body) as unknown;
	} catch {
		return undefined;
	}
};

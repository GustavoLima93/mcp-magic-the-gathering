import type {
	CardSearchDirection,
	CardSearchFormat,
	CardSearchOrder,
	CardSearchUnique,
	SearchCardsRepositoryInput,
	SearchCardsUseCaseInput,
} from '@/domain/entity/models/card-search';
import { SearchCardsValidationError } from '@/domain/use-case/error/search-cards-error';

export const CARD_SEARCH_UNIQUE_VALUES = [
	'cards',
	'art',
	'prints',
] as const satisfies readonly CardSearchUnique[];

export const CARD_SEARCH_ORDER_VALUES = [
	'name',
	'set',
	'released',
	'rarity',
	'color',
	'usd',
	'tix',
	'eur',
	'cmc',
	'power',
	'toughness',
	'edhrec',
	'penny',
	'artist',
	'review',
] as const satisfies readonly CardSearchOrder[];

export const CARD_SEARCH_DIRECTION_VALUES = [
	'auto',
	'asc',
	'desc',
] as const satisfies readonly CardSearchDirection[];

export const CARD_SEARCH_FORMAT_VALUES = [
	'json',
	'csv',
] as const satisfies readonly CardSearchFormat[];

const MAX_QUERY_UNICODE_CHARACTERS = 1000;

const isOneOf = <T extends string>(
	value: unknown,
	values: readonly T[],
): value is T => {
	return typeof value === 'string' && values.includes(value as T);
};

export class CardSearch {
	private readonly q: string;
	private readonly unique: CardSearchUnique;
	private readonly order: CardSearchOrder;
	private readonly dir: CardSearchDirection;
	private readonly includeExtras: boolean;
	private readonly includeMultilingual: boolean;
	private readonly includeVariations: boolean;
	private readonly page: number;
	private readonly format: CardSearchFormat;
	private readonly pretty: boolean;

	constructor(input: SearchCardsUseCaseInput) {
		this.q = this.validateQuery(input.q);
		this.unique = this.validateUnique(input.unique);
		this.order = this.validateOrder(input.order);
		this.dir = this.validateDirection(input.dir);
		this.includeExtras = input.includeExtras ?? false;
		this.includeMultilingual = input.includeMultilingual ?? false;
		this.includeVariations = input.includeVariations ?? false;
		this.page = this.validatePage(input.page);
		this.format = this.validateFormat(input.format);
		this.pretty = input.pretty ?? false;
	}

	public toRepositoryInput(): SearchCardsRepositoryInput {
		return {
			q: this.q,
			unique: this.unique,
			order: this.order,
			dir: this.dir,
			includeExtras: this.includeExtras,
			includeMultilingual: this.includeMultilingual,
			includeVariations: this.includeVariations,
			page: this.page,
			format: this.format,
			pretty: this.pretty,
		};
	}

	private validateQuery(query: unknown): string {
		if (typeof query !== 'string') {
			throw new SearchCardsValidationError('Search query is required.');
		}

		const trimmedQuery = query.trim();

		if (!trimmedQuery) {
			throw new SearchCardsValidationError('Search query cannot be blank.');
		}

		if (Array.from(trimmedQuery).length > MAX_QUERY_UNICODE_CHARACTERS) {
			throw new SearchCardsValidationError(
				'Search query must be at most 1000 Unicode characters.',
			);
		}

		return trimmedQuery;
	}

	private validatePage(page: unknown): number {
		if (page === undefined) {
			return 1;
		}

		if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
			throw new SearchCardsValidationError(
				'Search page must be a positive integer.',
			);
		}

		return page;
	}

	private validateUnique(unique: unknown): CardSearchUnique {
		if (unique === undefined) {
			return 'cards';
		}

		if (!isOneOf(unique, CARD_SEARCH_UNIQUE_VALUES)) {
			throw new SearchCardsValidationError(
				'Search unique option must be one of: cards, art, prints.',
			);
		}

		return unique;
	}

	private validateOrder(order: unknown): CardSearchOrder {
		if (order === undefined) {
			return 'name';
		}

		if (!isOneOf(order, CARD_SEARCH_ORDER_VALUES)) {
			throw new SearchCardsValidationError(
				`Search order option must be one of: ${CARD_SEARCH_ORDER_VALUES.join(
					', ',
				)}.`,
			);
		}

		return order;
	}

	private validateDirection(direction: unknown): CardSearchDirection {
		if (direction === undefined) {
			return 'auto';
		}

		if (!isOneOf(direction, CARD_SEARCH_DIRECTION_VALUES)) {
			throw new SearchCardsValidationError(
				'Search direction option must be one of: auto, asc, desc.',
			);
		}

		return direction;
	}

	private validateFormat(format: unknown): CardSearchFormat {
		if (format === undefined) {
			return 'json';
		}

		if (!isOneOf(format, CARD_SEARCH_FORMAT_VALUES)) {
			throw new SearchCardsValidationError(
				'Search format option must be one of: json, csv.',
			);
		}

		return format;
	}
}

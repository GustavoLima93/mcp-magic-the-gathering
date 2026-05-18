import z from 'zod';
import {
	CARD_SEARCH_DIRECTION_VALUES,
	CARD_SEARCH_FORMAT_VALUES,
	CARD_SEARCH_ORDER_VALUES,
	CARD_SEARCH_UNIQUE_VALUES,
} from '@/domain/entity/card-search';

export const searchCardsInputSchema = {
	q: z
		.string()
		.trim()
		.min(1)
		.max(1000)
		.describe(
			"Scryfall fulltext search query, for example 'c:red pow=3' or 't:creature cmc<=2'.",
		),
	unique: z
		.enum(CARD_SEARCH_UNIQUE_VALUES)
		.optional()
		.describe('Rollup strategy for matching cards. Defaults to cards.'),
	order: z
		.enum(CARD_SEARCH_ORDER_VALUES)
		.optional()
		.describe('Sort order for Scryfall search results. Defaults to name.'),
	dir: z
		.enum(CARD_SEARCH_DIRECTION_VALUES)
		.optional()
		.describe('Sort direction. Defaults to auto.'),
	include_extras: z
		.boolean()
		.optional()
		.describe('Include tokens, planes, schemes, and other extra cards.'),
	include_multilingual: z
		.boolean()
		.optional()
		.describe('Include cards printed in languages other than English.'),
	include_variations: z
		.boolean()
		.optional()
		.describe('Include rare card variants.'),
	page: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe('Scryfall result page, starting at 1.'),
	format: z
		.enum(CARD_SEARCH_FORMAT_VALUES)
		.optional()
		.describe(
			'Response format. json returns compact structured cards; csv returns raw CSV text.',
		),
	pretty: z
		.boolean()
		.optional()
		.describe(
			'Ask Scryfall to pretty-print JSON responses. Defaults to false.',
		),
} as const;

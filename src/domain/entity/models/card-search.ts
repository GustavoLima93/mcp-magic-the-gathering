export type CardSearchUnique = 'cards' | 'art' | 'prints';

export type CardSearchOrder =
	| 'name'
	| 'set'
	| 'released'
	| 'rarity'
	| 'color'
	| 'usd'
	| 'tix'
	| 'eur'
	| 'cmc'
	| 'power'
	| 'toughness'
	| 'edhrec'
	| 'penny'
	| 'artist'
	| 'review';

export type CardSearchDirection = 'auto' | 'asc' | 'desc';

export type CardSearchFormat = 'json' | 'csv';

export interface SearchCardsUseCaseInput {
	q?: string;
	unique?: CardSearchUnique;
	order?: CardSearchOrder;
	dir?: CardSearchDirection;
	includeExtras?: boolean;
	includeMultilingual?: boolean;
	includeVariations?: boolean;
	page?: number;
	format?: CardSearchFormat;
	pretty?: boolean;
}

export interface SearchCardsRepositoryInput {
	q: string;
	unique: CardSearchUnique;
	order: CardSearchOrder;
	dir: CardSearchDirection;
	includeExtras: boolean;
	includeMultilingual: boolean;
	includeVariations: boolean;
	page: number;
	format: CardSearchFormat;
	pretty: boolean;
}

export interface CompactCardImageUris extends Record<string, unknown> {
	small?: string;
	normal?: string;
	large?: string;
	png?: string;
	artCrop?: string;
	borderCrop?: string;
}

export interface CompactCard extends Record<string, unknown> {
	id: string;
	name: string;
	manaCost?: string;
	typeLine?: string;
	oracleText?: string;
	colors?: string[];
	colorIdentity?: string[];
	legalities?: Record<string, string>;
	releasedAt?: string;
	set?: string;
	setName?: string;
	collectorNumber?: string;
	rarity?: string;
	scryfallUri?: string;
	imageUris?: CompactCardImageUris;
}

export interface SearchCardsJsonResult extends Record<string, unknown> {
	format: 'json';
	query: string;
	page: number;
	object: 'list';
	totalCards: number;
	hasMore: boolean;
	nextPage?: string;
	warnings?: string[];
	data: CompactCard[];
}

export interface SearchCardsCsvResult extends Record<string, unknown> {
	format: 'csv';
	query: string;
	page: number;
	csv: string;
}

export type SearchCardsResult = SearchCardsJsonResult | SearchCardsCsvResult;

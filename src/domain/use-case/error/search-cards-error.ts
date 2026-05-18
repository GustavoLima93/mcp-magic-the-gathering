export type SearchCardsErrorCode =
	| 'SEARCH_CARDS_VALIDATION_ERROR'
	| 'SCRYFALL_UPSTREAM_ERROR'
	| 'SCRYFALL_UNAVAILABLE'
	| 'SCRYFALL_MALFORMED_PAYLOAD';

export interface SearchCardsErrorDetails {
	status?: number;
	upstreamCode?: string;
}

export class SearchCardsError extends Error {
	public readonly code: SearchCardsErrorCode;
	public readonly status: number | undefined;
	public readonly upstreamCode: string | undefined;

	constructor(
		message: string,
		code: SearchCardsErrorCode,
		details: SearchCardsErrorDetails = {},
	) {
		super(message);
		this.name = new.target.name;
		this.code = code;
		this.status = details.status;
		this.upstreamCode = details.upstreamCode;
	}
}

export class SearchCardsValidationError extends SearchCardsError {
	constructor(message: string) {
		super(message, 'SEARCH_CARDS_VALIDATION_ERROR');
	}
}

export class SearchCardsUpstreamError extends SearchCardsError {
	constructor(message: string, details: SearchCardsErrorDetails = {}) {
		super(message, 'SCRYFALL_UPSTREAM_ERROR', details);
	}
}

export class SearchCardsUnavailableError extends SearchCardsError {
	constructor(message = 'Scryfall is unavailable. Try again later.') {
		super(message, 'SCRYFALL_UNAVAILABLE');
	}
}

export class SearchCardsMalformedPayloadError extends SearchCardsError {
	constructor(message = 'Scryfall returned an invalid payload.') {
		super(message, 'SCRYFALL_MALFORMED_PAYLOAD');
	}
}

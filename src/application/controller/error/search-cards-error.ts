import type { ToolControllerResult } from '@/application/types';
import { SearchCardsError } from '@/domain/use-case/error/search-cards-error';

export const formatSearchCardsError = (
	error: unknown,
): ToolControllerResult => {
	const payload = errorToPayload(error);

	return {
		isError: true,
		structuredContent: payload,
		content: [
			{
				type: 'text',
				text: String(payload.error),
			},
		],
	};
};

const errorToPayload = (error: unknown): Record<string, unknown> => {
	if (error instanceof SearchCardsError) {
		const payload: Record<string, unknown> = {
			error: error.message,
			code: error.code,
		};

		if (error.status !== undefined) {
			payload.status = error.status;
		}

		if (error.upstreamCode !== undefined) {
			payload.upstreamCode = error.upstreamCode;
		}

		return payload;
	}

	return {
		error: 'Unexpected error while searching Scryfall cards.',
		code: 'SEARCH_CARDS_UNEXPECTED_ERROR',
	};
};

import type {
	SearchCardsToolInput,
	ToolControllerResult,
} from '@/application/types';
import type {
	SearchCardsResult,
	SearchCardsUseCaseInput,
} from '@/domain/entity/models/card-search';

export const toSearchCardsUseCaseInput = (
	toolInput: SearchCardsToolInput,
): SearchCardsUseCaseInput => {
	const useCaseInput: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(toolInput)) {
		if (value !== undefined) {
			const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
				letter.toUpperCase(),
			);
			useCaseInput[camelKey] = value;
		}
	}

	return useCaseInput as SearchCardsUseCaseInput;
};

export const formatSearchCardsResult = (
	result: SearchCardsResult,
): ToolControllerResult => {
	if (result.format === 'csv') {
		return {
			structuredContent: {
				format: result.format,
				query: result.query,
				page: result.page,
			},
			content: [
				{
					type: 'text',
					text: result.csv,
				},
			],
		};
	}

	return {
		structuredContent: result,
		content: [
			{
				type: 'text',
				text: JSON.stringify(result),
			},
		],
	};
};

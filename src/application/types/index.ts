import type {
	CardSearchDirection,
	CardSearchFormat,
	CardSearchOrder,
	CardSearchUnique,
} from '@/domain/entity/models/card-search';

export type ToolTextContent = {
	type: 'text';
	text: string;
};

export interface ToolControllerResult {
	[key: string]: unknown;
	structuredContent?: Record<string, unknown>;
	content: ToolTextContent[];
	isError?: boolean;
}

type MaybePromise<T> = T | Promise<T>;

export type ToolController<Input = undefined> = [Input] extends [undefined]
	? () => MaybePromise<ToolControllerResult>
	: (input: Input) => MaybePromise<ToolControllerResult>;

export interface SearchCardsToolInput {
	q: string;
	unique?: CardSearchUnique | undefined;
	order?: CardSearchOrder | undefined;
	dir?: CardSearchDirection | undefined;
	include_extras?: boolean | undefined;
	include_multilingual?: boolean | undefined;
	include_variations?: boolean | undefined;
	page?: number | undefined;
	format?: CardSearchFormat | undefined;
	pretty?: boolean | undefined;
}

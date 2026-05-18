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

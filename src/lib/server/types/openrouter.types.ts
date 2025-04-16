import type { DatabaseSchema } from './db.types';

export type SampleTableToolCall = {
	id: string;
	type: 'function';
	function: {
		name: 'sampleTable';
		arguments: string;
	};
};

export type AIToolCall = SampleTableToolCall;

export type MessageRole = 'user' | 'system' | 'assistant' | 'tool';

export type Message = {
	role: MessageRole;
	content: string | null;
	tool_calls?: AIToolCall[];
	tool_call_id?: string;
	name?: string;
};

export type AIToolDefinition = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
};

export type OpenRouterRequest = Partial<{
	model: string;
	messages: Message[];
	response_format?: {
		type: 'json_object';
	};
	temperature?: number;
	max_tokens?: number;
	tools?: AIToolDefinition[];
	tool_choice?:
		| 'auto'
		| 'none'
		| {
				type: 'function';
				function: {
					name: string;
				};
		  };
}>;

export type OpenRouterResponse = {
	id: string;
	choices: Array<{
		message: {
			role: string;
			content: string | null;
			tool_calls?: AIToolCall[];
		};
		finish_reason: string;
	}>;
};

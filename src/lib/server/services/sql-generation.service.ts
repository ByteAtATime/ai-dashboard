import { injectable, inject } from '@needle-di/core';
import { SchemaService } from './schema.service';
import { OpenRouterService } from './openrouter.service';
import { ToolService, type HandleToolCallResult } from './tool.service';
import { PromptService } from './prompt.service';
import type { DisplayConfig, QueryContext } from '../types/display.types';
import type { Message, OpenRouterRequest } from '../types/openrouter.types';
import { env } from '$env/dynamic/private';

export type SqlGenerationResult = {
	display: DisplayConfig[];
	explanation?: string;
};

export type ProgressCallback = (message: string) => Promise<void>;

const MODELS_SUPPORTING_PREFILLED_OUTPUT = ['anthropic/claude-3.5-haiku'];

@injectable()
export class SqlGenerationService {
	constructor(
		private schemaService = inject(SchemaService),
		private openRouterService = inject(OpenRouterService),
		private toolService = inject(ToolService),
		private promptService = inject(PromptService)
	) {}

	async generateSql(
		query: string,
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult> {
		const schemaDescription = await this.schemaService.getFormattedSchemaForAI();
		const systemPrompt = this.promptService.createInitialQueryPrompt(schemaDescription);
		const tools = this.toolService.getToolDefinitions();

		const messages: Message[] = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: query }
		];

		try {
			let finalResponse: SqlGenerationResult | null = null;

			while (!finalResponse) {
				if (progressCallback) {
					await progressCallback('Generating SQL query...');
				}

				// force tool call on the first turn for initial query so it samples data
				const toolChoice =
					messages.length <= 2
						? { type: 'function' as const, function: { name: 'sampleTable' } }
						: 'auto';

				const model = this.openRouterService.model;
				const prefilledMessages = MODELS_SUPPORTING_PREFILLED_OUTPUT.includes(model)
					? messages
					: [...messages, { role: 'assistant', content: '{' } as const];

				const request: OpenRouterRequest = {
					messages: prefilledMessages,
					tools,
					tool_choice: toolChoice,
					temperature: 0.1,
					max_tokens: 1024,
					model
				};

				const data = await this.openRouterService.chatCompletion(request);
				const choice = data.choices[0];
				const message = choice.message;

				messages.push({
					role: 'assistant',
					content: message.content,
					tool_calls: message.tool_calls
				});

				if (message.tool_calls && message.tool_calls.length > 0) {
					console.log(`Tool call detected: ${message.tool_calls[0].function.name}`);
					for (const toolCall of message.tool_calls) {
						const result: HandleToolCallResult = await this.toolService.handleToolCall(
							toolCall,
							progressCallback
						);
						messages.push({
							role: 'tool',
							content: result.content,
							tool_call_id: result.tool_call_id,
							name: result.name
						});
					}
				} else if (message.content) {
					const content = message.content.replace(/```json\s*|\s*```/g, '');
					try {
						const jsonResponse = JSON.parse(content);
						if (jsonResponse.display && Array.isArray(jsonResponse.display)) {
							if (progressCallback) {
								await progressCallback('Finalizing SQL queries');
							}
							finalResponse = {
								display: jsonResponse.display as DisplayConfig[],
								explanation: jsonResponse.explanation
							};
						} else {
							console.warn(
								'Received content from AI that was not a tool call or valid JSON display format:',
								message.content
							);
						}
					} catch (error) {
						console.error(
							'Failed to parse AI response as JSON:',
							error instanceof Error ? error.message : 'Unknown error',
							message.content
						);
					}
				}
			}

			return finalResponse;
		} catch (error) {
			console.error('Error generating SQL:', error);
			throw error;
		}
	}

	async generateFollowupSql(
		followupInstruction: string,
		previousContext: QueryContext,
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult> {
		const schemaDescription = await this.schemaService.getFormattedSchemaForAI();
		const systemPrompt = this.promptService.createFollowupQueryPrompt(
			followupInstruction,
			previousContext,
			schemaDescription
		);
		const tools = this.toolService.getToolDefinitions();

		const messages: Message[] = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: followupInstruction }
		];

		try {
			let finalResponse: SqlGenerationResult | null = null;

			while (!finalResponse) {
				if (progressCallback) {
					await progressCallback('Processing follow-up instruction...');
				}

				const model = this.openRouterService.model;
				const request: OpenRouterRequest = {
					messages,
					tools,
					tool_choice: 'auto',
					temperature: 0.1,
					max_tokens: 1024,
					model
				};

				const data = await this.openRouterService.chatCompletion(request);
				const choice = data.choices[0];
				const message = choice.message;

				messages.push({
					role: 'assistant',
					content: message.content,
					tool_calls: message.tool_calls
				});

				if (message.tool_calls && message.tool_calls.length > 0) {
					console.log(`Tool call detected: ${message.tool_calls[0].function.name}`);
					for (const toolCall of message.tool_calls) {
						const result: HandleToolCallResult = await this.toolService.handleToolCall(
							toolCall,
							progressCallback
						);
						messages.push({
							role: 'tool',
							content: result.content,
							tool_call_id: result.tool_call_id,
							name: result.name
						});
					}
				} else if (message.content) {
					const content = message.content.replace(/```json\s*|\s*```/g, '');
					try {
						const jsonResponse = JSON.parse(content);
						if (jsonResponse.display && Array.isArray(jsonResponse.display)) {
							if (progressCallback) {
								await progressCallback('Finalizing SQL queries for follow-up');
							}
							finalResponse = {
								display: jsonResponse.display as DisplayConfig[],
								explanation: jsonResponse.explanation
							};
						} else {
							console.warn(
								'Received content from AI that was not a tool call or valid JSON display format:',
								message.content
							);
						}
					} catch (error) {
						console.error(
							'Failed to parse AI response as JSON:',
							error instanceof Error ? error.message : 'Unknown error',
							message.content
						);
					}
				}
			}

			return finalResponse;
		} catch (error) {
			console.error('Error generating follow-up SQL:', error);
			throw error;
		}
	}
}

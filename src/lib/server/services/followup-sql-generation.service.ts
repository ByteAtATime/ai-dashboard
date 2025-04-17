import { injectable, inject } from '@needle-di/core';
import { SchemaService } from './schema.service';
import { OpenRouterService } from './openrouter.service';
import { ToolService, type HandleToolCallResult } from './tool.service';
import { PromptService } from './prompt.service';
import type { DisplayConfig, QueryContext } from '../types/display.types';
import type { Message, OpenRouterRequest } from '../types/openrouter.types';
import type { SqlGenerationResult, ProgressCallback } from '../interfaces/sql-generation.interface';

@injectable()
export class FollowupSqlGenerationService {
	constructor(
		private schemaService: SchemaService,
		private openRouterService: OpenRouterService,
		private toolService: ToolService,
		private promptService: PromptService
	) {}

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

				finalResponse = await this.processAssistantResponse(message, messages, progressCallback);
			}

			return finalResponse;
		} catch (error) {
			console.error('Error generating follow-up SQL:', error);
			throw error;
		}
	}

	private async processAssistantResponse(
		message: any,
		messages: Message[],
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult | null> {
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
			return null; // Continue the loop
		} else if (message.content) {
			return this.parseAIResponse(message.content, progressCallback);
		}
		return null;
	}

	private async parseAIResponse(
		content: string,
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult | null> {
		const cleanContent = content.replace(/```json\s*|\s*```/g, '');
		try {
			const jsonResponse = JSON.parse(cleanContent);
			if (jsonResponse.display && Array.isArray(jsonResponse.display)) {
				if (progressCallback) {
					await progressCallback('Finalizing SQL queries for follow-up');
				}
				return {
					display: jsonResponse.display as DisplayConfig[],
					explanation: jsonResponse.explanation
				};
			} else {
				console.warn(
					'Received content from AI that was not a tool call or valid JSON display format:',
					content
				);
				return null;
			}
		} catch (error) {
			console.error(
				'Failed to parse AI response as JSON:',
				error instanceof Error ? error.message : 'Unknown error',
				content
			);
			return null;
		}
	}
}

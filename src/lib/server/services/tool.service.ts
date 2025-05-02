import { injectable, inject } from '@needle-di/core';
import { PostgresRepository } from '../repositories/postgres.repository';
import type { AIToolCall, AIToolDefinition } from '../types/openrouter.types';

export type HandleToolCallResult = {
	tool_call_id: string;
	name: string;
	content: string;
};

@injectable()
export class ToolService {
	constructor(private postgresRepository = inject(PostgresRepository)) {}

	getToolDefinitions(): AIToolDefinition[] {
		return [
			{
				type: 'function',
				function: {
					name: 'sampleTable',
					description:
						'Get sample rows from a specific table to understand its data structure - MUST be called before generating SQL for tables not previously sampled',
					parameters: {
						type: 'object',
						properties: {
							tableName: {
								type: 'string',
								description: 'The name of the table to sample from'
							},
							numRows: {
								type: 'integer',
								description: 'Number of rows to return (between 1 and 10)'
							}
						},
						required: ['tableName', 'numRows']
					}
				}
			}
		];
	}

	async handleToolCall(
		toolCall: AIToolCall,
		connectionString: string,
		progressCallback?: (message: string) => Promise<void>
	): Promise<HandleToolCallResult> {
		const functionName = toolCall.function.name;

		let functionArgs: { tableName: string; numRows: number };
		try {
			functionArgs = JSON.parse(toolCall.function.arguments);
		} catch (error) {
			console.error(
				`Failed to parse tool call arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			console.error(`Arguments: ${toolCall.function.arguments}`);
			throw new Error(`Unable to parse arguments for ${functionName}`);
		}

		let functionResult;
		if (functionName === 'sampleTable') {
			if (progressCallback) {
				await progressCallback(
					`Sampling ${functionArgs.numRows} rows from \`${functionArgs.tableName}\` table`
				);
			}
			functionResult = await this.postgresRepository.sampleTable(
				functionArgs.tableName,
				functionArgs.numRows,
				connectionString
			);
		} else {
			console.error(`Unknown function called: ${functionName}`);
			throw new Error(`Unknown function: ${functionName}`);
		}

		return {
			tool_call_id: toolCall.id,
			name: functionName,
			content: JSON.stringify(functionResult)
		};
	}
}

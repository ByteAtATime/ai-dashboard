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
		const sanitizedArgs = this.sanitizeToolCallArguments(toolCall.function.arguments);

		let functionArgs: { tableName: string; numRows: number };
		try {
			functionArgs = JSON.parse(sanitizedArgs);
		} catch (error) {
			console.error(
				`Failed to parse tool call arguments after sanitization: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			console.error(`Original arguments: ${toolCall.function.arguments}`);
			console.error(`Sanitized arguments: ${sanitizedArgs}`);
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

	private sanitizeToolCallArguments(argsString: string): string {
		if (argsString.includes('}{') || argsString.match(/\d+\{/)) {
			try {
				JSON.parse(argsString);
				return argsString;
			} catch {
				const openBraces = argsString.match(/{/g)?.length || 0;
				const closeBraces = argsString.match(/}/g)?.length || 0;

				if (openBraces > 1 && openBraces > closeBraces) {
					const splitMatches = argsString.match(/(\d+)({)/);
					if (splitMatches && splitMatches.index) {
						const splitIndex = splitMatches.index + splitMatches[1].length;
						const fixed = argsString.substring(0, splitIndex) + '}';

						try {
							JSON.parse(fixed);
							return fixed;
						} catch {
							// JSON.parse failed
						}
					}
				}

				const secondBraceIndex = argsString.indexOf('{', 1);
				if (secondBraceIndex > 0) {
					const secondHalf = argsString.substring(secondBraceIndex);
					try {
						JSON.parse(secondHalf);
						return secondHalf;
					} catch {
						// JSON.parse failed
					}
				}

				if (argsString.includes('}{')) {
					const parts = argsString.split('}{');
					const fixedSecondPart = '{' + parts[1];

					try {
						JSON.parse(fixedSecondPart);
						return fixedSecondPart;
					} catch {
						// JSON.parse failed
					}
				}

				const jsonPattern = /{[^{}]*}/;
				const match = argsString.match(jsonPattern);
				if (match && match[0]) {
					try {
						JSON.parse(match[0]);
						return match[0];
					} catch {
						// JSON.parse failed
					}
				}
			}
		}

		return argsString;
	}
}

import { env } from '$env/dynamic/private';
import type { DatabaseSchema } from './db';
import pool from './db';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

export type TableDisplay = {
	type: 'table';
	columns: Record<string, string>;
	description?: string;
};

export type StatsDisplay = {
	type: 'stats';
	stats: Array<{
		id: string;
		name: string;
		unit?: string;
		description?: string;
	}>;
	summary?: string;
};

export type ChartDisplay = {
	type: 'barchart' | 'linechart' | 'piechart';
	xAxis?: string;
	yAxis?: string;
	groupBy?: string;
	title?: string;
};

export type DisplayConfig = TableDisplay | StatsDisplay | ChartDisplay;

type SampleTableToolCall = {
	id: string;
	type: 'function';
	function: {
		name: 'sampleTable';
		arguments: string;
	};
};

type AIToolCall = SampleTableToolCall;

type MessageRole = 'user' | 'system' | 'assistant' | 'tool';

type Message = {
	role: MessageRole;
	content: string | null;
	tool_calls?: AIToolCall[];
	tool_call_id?: string;
	name?: string;
};

type OpenRouterRequest = {
	model: string;
	messages: Message[];
	response_format?: {
		type: 'json_object';
	};
	temperature?: number;
	max_tokens?: number;
	tools?: Array<{
		type: 'function';
		function: {
			name: string;
			description: string;
			parameters: Record<string, unknown>;
		};
	}>;
	tool_choice?:
		| 'auto'
		| 'none'
		| {
				type: 'function';
				function: {
					name: string;
				};
		  };
};

type OpenRouterResponse = {
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

async function sampleTable(tableName: string, numRows: number): Promise<Record<string, unknown>[]> {
	console.log(`🔍 Function called: sampleTable(${tableName}, ${numRows})`);
	const client = await pool.connect();
	try {
		const validateTableName = (tableName: string): void => {
			if (!/^[a-zA_Z_][a-zA-Z0-9_]*$/.test(tableName)) {
				throw new Error(`Invalid table name: ${tableName}`);
			}
		};

		validateTableName(tableName);
		const safeLimit = Math.min(Math.max(1, numRows), 10);

		const countResult = await client.query(`SELECT COUNT(*)::int FROM "${tableName}"`);
		const count = countResult.rows[0].count;

		if (count === 0) {
			return [];
		}

		if (count <= safeLimit) {
			const result = await client.query(`SELECT * FROM "${tableName}"`);
			return result.rows;
		}

		const result = await client.query(`SELECT * FROM "${tableName}" ORDER BY RANDOM() LIMIT $1`, [
			safeLimit
		]);
		return result.rows;
	} finally {
		client.release();
	}
}

function sanitizeToolCallArguments(argsString: string): string {
	// explanation: for some reason, mistral models are horrible at function calling
	// sometimes, they return arguments like `{"tableName": "users", "numRows": 5{"tableName": "users", "numRows": 5}``
	// either way, i have no idea what i am doing here
	if (argsString.includes('}{') || argsString.match(/\d+\{/)) {
		try {
			JSON.parse(argsString);
			return argsString;
		} catch (error) {
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
					} catch {}
				}
			}

			const secondBraceIndex = argsString.indexOf('{', 1);
			if (secondBraceIndex > 0) {
				const secondHalf = argsString.substring(secondBraceIndex);
				try {
					JSON.parse(secondHalf);
					return secondHalf;
				} catch {}
			}

			if (argsString.includes('}{')) {
				const parts = argsString.split('}{');
				const fixedSecondPart = '{' + parts[1];

				try {
					JSON.parse(fixedSecondPart);
					return fixedSecondPart;
				} catch {}
			}

			const jsonPattern = /{[^{}]*}/;
			const match = argsString.match(jsonPattern);
			if (match && match[0]) {
				try {
					JSON.parse(match[0]);
					return match[0];
				} catch {}
			}
		}
	}

	return argsString;
}

export async function generateSQL(
	query: string,
	schema: DatabaseSchema
): Promise<{ sql: string; display: DisplayConfig; explanation?: string }> {
	const schemaDescription = formatSchemaForAI(schema);

	const systemPrompt = `You are an expert SQL engineer that translates natural language queries into PostgreSQL SQL.

DATABASE SCHEMA:
${schemaDescription}

INSTRUCTIONS:
1. Carefully analyze the user's query and determine what information is needed
2. Sample random rows from relevant tables to better understand their structure
3. Generate optimized PostgreSQL-compatible SQL that answers the query
4. Suggest the most appropriate display format for the results
5. Return ONLY valid JSON with this exact structure:
{
  "sql": "The SQL query (without backticks or markdown)",
  "display": {
    "type": "table | stats | barchart | linechart | piechart",
    ...displayConfigFields
  },
  "explanation": "Brief explanation of the query approach (optional)"
}

If you need sample data from a specific table to better understand its structure, you can use the sampleTable tool.

DISPLAY TYPE DETAILS:

1. For "table":
{
  "type": "table",
  "columns": {
    "db_column_name": "User-friendly display name",
    ...
  },
  "description": "Optional context about what this table shows"
}

2. For "stats":
{
  "type": "stats",
  "stats": [
    {
      "id": "column_name",
      "name": "Stat display name",
      "unit": "Optional unit (%, $, etc.)",
      "description": "What this stat represents"
    },
    ...
  ],
  "summary": "Optional overall interpretation"
}

3. For charts:
{
  "type": "barchart | linechart | piechart",
  "xAxis": "column_for_x_axis",
  "yAxis": "column_for_y_axis",
  "groupBy": "optional_grouping_column",
  "title": "Chart title"
}

IMPORTANT:
- Always use proper JOINs based on foreign key relationships
- Consider NULL values and use COALESCE when appropriate
- Use table aliases for complex queries
- Include relevant WHERE clauses for filtering
- Add comments to complex SQL for clarity
- Output ONLY valid JSON - no explanatory text before or after and no code fences`;

	const tools = [
		{
			type: 'function',
			function: {
				name: 'sampleTable',
				description: 'Get sample rows from a specific table to understand its data structure',
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

	const messages: Message[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: query }
	];

	try {
		let finalResponse: { sql: string; display: DisplayConfig; explanation?: string } | null = null;

		while (!finalResponse) {
			const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
					'HTTP-Referer': env.APP_HOST || 'http://localhost:5173',
					'X-Title': 'AI SQL Generator'
				},
				body: JSON.stringify({
					model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
					messages,
					tools,
					tool_choice: 'auto',
					temperature: 0.1,
					max_tokens: 1024
				} as OpenRouterRequest)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
			}

			const data = (await response.json()) as OpenRouterResponse;
			if (!data.choices || data.choices.length === 0) {
				console.log(data);
				throw new Error('No response from OpenRouter API');
			}

			const choice = data.choices[0];
			const message = choice.message;

			messages.push({
				role: 'assistant',
				content: message.content,
				tool_calls: message.tool_calls
			} as Message);

			if (message.tool_calls && message.tool_calls.length > 0) {
				console.log(`Tool call detected: ${message.tool_calls[0].function.name}`);

				for (const toolCall of message.tool_calls) {
					const functionName = toolCall.function.name;

					const sanitizedArgs = sanitizeToolCallArguments(toolCall.function.arguments);

					let functionArgs;
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
						functionResult = await sampleTable(functionArgs.tableName, functionArgs.numRows);
					} else {
						throw new Error(`Unknown function: ${functionName}`);
					}

					messages.push({
						role: 'tool',
						content: JSON.stringify(functionResult),
						tool_call_id: toolCall.id,
						name: functionName
					} as Message);
				}
			} else if (message.content) {
				const content = message.content.replace(/```json\s*|\s*```/g, '');
				try {
					const jsonResponse = JSON.parse(content);
					if (jsonResponse.sql && jsonResponse.display) {
						finalResponse = {
							sql: jsonResponse.sql,
							display: jsonResponse.display,
							explanation: jsonResponse.explanation
						};
					}
				} catch (error) {
					console.error(
						'Failed to parse AI response as JSON:',
						error instanceof Error ? error.message : 'Unknown error'
					);
				}
			}
		}

		return finalResponse;
	} catch (error) {
		console.error('Error calling OpenRouter:', error);
		throw error;
	}
}

function formatSchemaForAI(schema: DatabaseSchema): string {
	let output = '';

	if (schema.enums.length > 0) {
		output += '## Enums (Custom Types)\n';
		for (const enumDef of schema.enums) {
			output += `- ${enumDef.name}: ${enumDef.values.join(', ')}\n`;
		}
		output += '\n';
	}

	output += '## Tables\n';
	for (const table of schema.tables) {
		output += `### ${table.name} (${table.rowCount} rows)\n`;

		output += '#### Columns:\n';
		for (const column of table.columns) {
			output += `- ${column.name}: ${column.type}`;
			if (column.udtName && column.udtName !== column.type) output += ` (${column.udtName})`;
			if (!column.nullable) output += ' NOT NULL';
			if (column.defaultValue) output += ` DEFAULT ${column.defaultValue}`;
			if (column.isPrimaryKey) output += ' [PRIMARY KEY]';
			if (column.isForeignKey)
				output += ` [FOREIGN KEY → ${column.foreignTable}.${column.foreignColumn}]`;
			output += '\n';
		}
		output += '\n';
	}

	return output;
}

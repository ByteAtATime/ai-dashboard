import { env } from '$env/dynamic/private';
import type { DatabaseSchema } from './postgres';
import pool from './postgres';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

export type TableDisplay = {
	type: 'table';
	sql: string;
	columns: Record<string, string>;
	description?: string;
};

export type StatDisplay = {
	type: 'stat';
	sql: string;
	id: string;
	name: string;
	unit?: string;
	description?: string;
};

export type DisplayConfig = TableDisplay | StatDisplay;

export type QueryContext = {
	query: string;
	display: (DisplayConfig & { results: Record<string, unknown>[] })[];
	explanation?: string;
};

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
): Promise<{ display: DisplayConfig[]; explanation?: string }> {
	return generateSQLWithProgress(query, schema);
}

export async function generateFollowupSQL(
	followupInstruction: string,
	previousContext: QueryContext,
	schema: DatabaseSchema,
	progressCallback?: (progress: string) => Promise<void>
): Promise<{ display: DisplayConfig[]; explanation?: string }> {
	const schemaDescription = formatSchemaForAI(schema);

	const previousDisplayDescription = previousContext.display
		.map((config, index) => {
			const configType = config.type;
			const description = config.description || '';

			if (configType === 'table') {
				const tableConfig = config as TableDisplay & { results: Record<string, unknown>[] };
				const columns = Object.entries(tableConfig.columns)
					.map(([key, label]) => `${key} (${label})`)
					.join(', ');

				return `Display ${index + 1}: Table with columns [${columns}]
SQL: ${tableConfig.sql}
Description: ${description}
Sample Data: ${JSON.stringify(tableConfig.results.slice(0, 2))}`;
			} else if (configType === 'stat') {
				const statConfig = config as StatDisplay & { results: Record<string, unknown>[] };

				return `Display ${index + 1}: Stat "${statConfig.name}" (${statConfig.unit || ''})
SQL: ${statConfig.sql}
Description: ${description}
Value: ${JSON.stringify(statConfig.results[0]?.[statConfig.id])}`;
			}

			return '';
		})
		.join('\n\n');

	const systemPrompt = `You are an expert SQL engineer that translates natural language queries into PostgreSQL SQL.

DATABASE SCHEMA:
${schemaDescription}

PREVIOUS QUERY: "${previousContext.query}"

PREVIOUS QUERY RESULTS:
${previousDisplayDescription}

FOLLOW-UP INSTRUCTION:
"${followupInstruction}"

INSTRUCTIONS:
1. You are modifying or extending the previous query results based on the follow-up instruction
2. Analyze both the previous query context and the new instruction to understand what needs to change
3. You may:
   - Modify existing SQL queries to add/change columns, filtering, or calculations
   - Add new visualizations that complement the existing ones
   - Change display formats if requested
4. When appropriate, reuse parts of the previous SQL queries to maintain consistency
5. Important: you must sample random rows from relevant tables if you need additional data not used in previous queries
6. Return ONLY valid JSON with this exact structure:
{
  "display": [
    {
      "type": "table|stat",
      "sql": "SQL query for this specific visualization",
      ... other visualization-specific properties
    },
    ... more display objects
  ],
  "explanation": "Brief explanation of the changes made (optional)"
}

WORKFLOW REQUIREMENT:
- If you need to analyze new tables not used in the previous queries, call the sampleTable function first
- For tables already analyzed in previous queries, you can skip sampling again
- Do not remove existing useful visualizations unless specifically requested

The display MUST be an array of display objects following the same format as the previous query.

DISPLAY TYPE DETAILS:

1. For a data table:
{
  "type": "table",
  "sql": "SQL query that returns data for this table",
  "columns": {
    // doesn't have to be all columns, just the ones you want to show in this table
    "db_column_name": "User-friendly display name",
    ...
  },
  "description": "Optional context about what this table shows"
}

2. For individual statistics:
{
  "type": "stat",
  "sql": "SQL query that returns a single row with this stat",
  "id": "column_name",
  "name": "Stat display name",
  "unit": "Optional unit (%, $, etc.)",
  "description": "What this stat represents"
}

IMPORTANT:
- Each display object MUST have its own SQL query
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
				description:
					'Get sample rows from a specific table to understand its data structure - call only if needed for new tables',
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
		{ role: 'user', content: followupInstruction }
	];

	try {
		let finalResponse: { display: DisplayConfig[]; explanation?: string } | null = null;

		while (!finalResponse) {
			if (progressCallback) {
				await progressCallback('Processing follow-up instruction...');
			}

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
						if (progressCallback) {
							await progressCallback(
								`Sampling ${functionArgs.numRows} rows from \`${functionArgs.tableName}\` table`
							);
						}
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
					if (jsonResponse.display && Array.isArray(jsonResponse.display)) {
						if (progressCallback) {
							await progressCallback('Finalizing SQL queries for follow-up');
						}

						finalResponse = {
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
		console.error('Error calling OpenRouter for follow-up:', error);
		throw error;
	}
}

export async function generateSQLWithProgress(
	query: string,
	schema: DatabaseSchema,
	progressCallback?: (progress: string) => Promise<void>
): Promise<{ display: DisplayConfig[]; explanation?: string }> {
	const schemaDescription = formatSchemaForAI(schema);

	const systemPrompt = `You are an expert SQL engineer that translates natural language queries into PostgreSQL SQL.

DATABASE SCHEMA:
${schemaDescription}

INSTRUCTIONS:
1. Carefully analyze the user's query and determine what information is needed
2. Important: you must sample random rows from relevant tables to better understand their structure
3. Generate optimized PostgreSQL-compatible SQL queries for each visualization
4. Suggest the most appropriate display format for the results
5. Return ONLY valid JSON with this exact structure:
{
  "display": [
    {
      "type": "table|stat",
      "sql": "SQL query for this specific visualization",
      ... other visualization-specific properties
    },
    ... more display objects
  ],
  "explanation": "Brief explanation of the query approach (optional)"
}

IMPORTANT WORKFLOW REQUIREMENT:
- You MUST first call the sampleTable function to examine sample data before generating SQL
- Do not attempt to provide an answer without first sampling data from at least one relevant table
- This helps you understand the data structure and create a more accurate query

The display MUST be an array of display objects. Each object should be a separate visualization component with its own SQL query.

DISPLAY TYPE DETAILS:

1. For a data table:
{
  "type": "table",
  "sql": "SQL query that returns data for this table",
  "columns": {
    // doesn't have to be all columns, just the ones you want to show in this table
    "db_column_name": "User-friendly display name",
    ...
  },
  "description": "Optional context about what this table shows"
}

2. For individual statistics:
{
  "type": "stat",
  "sql": "SQL query that returns a single row with this stat",
  "id": "column_name",
  "name": "Stat display name",
  "unit": "Optional unit (%, $, etc.)",
  "description": "What this stat represents"
}

You can include multiple visualizations in sequence, each with its own SQL query:
"display": [
  { 
    "type": "stat", 
    "sql": "SELECT SUM(revenue) AS total_revenue FROM sales",
    "id": "total_revenue", 
    "name": "Total Revenue", 
    "unit": "$" 
  },
  { 
    "type": "table", 
    "sql": "SELECT customer_name, SUM(amount) AS amount FROM orders GROUP BY customer_name ORDER BY amount DESC LIMIT 10",
    "columns": { "customer_name": "Customer", "amount": "Amount" } 
  },
  { 
    "type": "stat", 
    "sql": "SELECT AVG(order_total) AS average_order FROM orders",
    "id": "average_order", 
    "name": "Average Order", 
    "unit": "$" 
  }
]

IMPORTANT:
- Each display object MUST have its own SQL query
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
				description:
					'Get sample rows from a specific table to understand its data structure - MUST be called before generating SQL',
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
		let finalResponse: { display: DisplayConfig[]; explanation?: string } | null = null;

		while (!finalResponse) {
			if (progressCallback) {
				await progressCallback('Generating SQL query...');
			}

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
					tool_choice:
						messages.length <= 2
							? {
									type: 'function',
									function: {
										name: 'sampleTable'
									}
								}
							: 'auto',
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
						if (progressCallback) {
							await progressCallback(
								`Sampling ${functionArgs.numRows} rows from \`${functionArgs.tableName}\` table`
							);
						}
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
					if (jsonResponse.display && Array.isArray(jsonResponse.display)) {
						if (progressCallback) {
							await progressCallback('Finalizing SQL queries');
						}

						finalResponse = {
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

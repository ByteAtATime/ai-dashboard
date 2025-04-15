import { env } from '$env/dynamic/private';
import type { DatabaseSchema } from './db';

const DEFAULT_MODEL = 'cognitivecomputations/dolphin3.0-mistral-24b:free';

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

type OpenRouterRequest = {
	model: string;
	messages: Array<{
		role: 'user' | 'system' | 'assistant';
		content: string;
	}>;
	response_format?: {
		type: 'json_object';
	};
	temperature?: number;
	max_tokens?: number;
};

type OpenRouterResponse = {
	id: string;
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
};

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
2. Consider the relationships between tables (foreign keys) and data types
3. Generate optimized PostgreSQL-compatible SQL that answers the query
4. Suggest the most appropriate display format for the results
5. Return ONLY valid JSON with this exact structure:
{
  "sql": "The SQL query (without backticks or markdown)",
  "display": {
    // Choose ONE of the following display types:
    // - "table": For tabular data with multiple rows/columns
    // - "stats": For key metrics that should be highlighted
    // - "barchart"/"linechart"/"piechart": For visualizations
    "type": "table | stats | barchart | linechart | piechart",
    // Additional fields based on display type:
    ...displayConfigFields
  },
  "explanation": "Brief explanation of the query approach (optional)"
}

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
- Output ONLY valid JSON - no explanatory text before or after`;

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'HTTP-Referer': env.APP_HOST || 'http://localhost:5173',
				'X-Title': 'AI SQL Generator'
			},
			body: JSON.stringify({
				model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: query }
				],
				response_format: { type: 'json_object' },
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
			throw new Error('No response from OpenRouter API');
		}

		try {
			const jsonResponse = JSON.parse(data.choices[0].message.content);
			return {
				sql: jsonResponse.sql,
				display: jsonResponse.display,
				explanation: jsonResponse.explanation
			};
		} catch (e) {
			throw new Error(`Failed to parse AI response as JSON: ${e}`);
		}
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
		output += `### ${table.name} (~${table.rowCount} rows)\n`;

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

		if (table.sampleRows.length > 0) {
			output += '#### Sample Data:\n';
			const sample = table.sampleRows.slice(0, 3);
			const columns = Object.keys(sample[0]);
			output += `| ${columns.join(' | ')} |\n`;
			output += `| ${columns.map(() => '---').join(' | ')} |\n`;
			for (const row of sample) {
				output += `| ${columns.map((col) => JSON.stringify(row[col])).join(' | ')} |\n`;
			}
		}
		output += '\n';
	}

	return output;
}

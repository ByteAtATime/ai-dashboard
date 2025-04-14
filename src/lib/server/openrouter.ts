import { env } from '$env/dynamic/private';

const DEFAULT_MODEL = 'cognitivecomputations/dolphin3.0-mistral-24b:free';

export type TableDisplay = {
	type: 'table';
	columns: Record<string, string>;
};

export type StatsDisplay = {
	type: 'stats';
	stats: Array<{
		id: string;
		name: string;
		unit?: string;
	}>;
};

export type ChartDisplay = {
	type: 'barchart' | 'linechart';
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
	schema: Record<string, any[]>,
	sampleData?: Record<string, any[]>
): Promise<{ sql: string; display: DisplayConfig }> {
	const schemaDescription = Object.entries(schema)
		.map(([tableName, columns]) => {
			const columnDefs = columns.map((col) => `  - ${col.name} (${col.type})`).join('\n');

			return `TABLE: ${tableName}\nCOLUMNS:\n${columnDefs}`;
		})
		.join('\n\n');

	let sampleDataDescription = '';
	if (sampleData && Object.keys(sampleData).length > 0) {
		sampleDataDescription =
			'\n\nSAMPLE DATA:\n' +
			Object.entries(sampleData)
				.map(([tableName, rows]) => {
					if (!rows || rows.length === 0) return '';

					return (
						`TABLE: ${tableName} (${rows.length} sample rows)\n` + JSON.stringify(rows, null, 2)
					);
				})
				.filter(Boolean)
				.join('\n\n');
	}

	const systemPrompt = `You are an expert SQL engineer that translates natural language queries into SQL.
  
DATABASE SCHEMA:
${schemaDescription}
${sampleDataDescription}

INSTRUCTIONS:
1. Analyze the user's query carefully
2. Generate PostgreSQL-compatible SQL that answers the query
3. Return ONLY valid JSON with this exact structure:
{
  "sql": "-- the SQL query without backticks",
  "display": {
    "type": "table | stats",
    ... fields based on type as follows:
  }
}

For display.type = "table":
{
  "type": "table",
  "columns": {
    "column1": "Display Title 1",
    "column2": "Display Title 2"
    
  }
}

For display.type = "stats":
{
  "type": "stats",
  "stats": [
    {
      "id": "column_name", 
      "name": "User-friendly stat name",
      "unit": "optional unit like '%' or '$'"
    },
    
  ]
}

Choose the most appropriate display type:
- Use "table" for raw data results with multiple rows/columns
- Use "stats" for a few key metrics that should be highlighted

Output only valid JSON - no explanation text before or after.`;

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
				display: jsonResponse.display
			};
		} catch (e) {
			throw new Error(`Failed to parse AI response as JSON: ${e}`);
		}
	} catch (error) {
		console.error('Error calling OpenRouter:', error);
		throw error;
	}
}

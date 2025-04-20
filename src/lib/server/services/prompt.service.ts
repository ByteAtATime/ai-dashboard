import { injectable } from '@needle-di/core';
import type { QueryContext, TableDisplay, StatDisplay, ChartDisplay } from '../types/display.types';

@injectable()
export class PromptService {
	createInitialQueryPrompt(schemaDescription: string): string {
		return `
# PostgreSQL Query Generator

You are an expert SQL engineer. Translate natural language requests into optimized PostgreSQL queries.

## Database Schema
\`\`\`
${schemaDescription}
\`\`\`

## Core Workflow
1. Analyze Request: Identify tables, joins, conditions.
2. Sample Data: MUST call \`sampleTable(table_name, rows = 5)\` for relevant tables before writing SQL to understand structure, types, relationships (NULLs, keys, ranges).
3. Generate SQL: Create optimized PostgreSQL queries for each visualization.
4. Recommend Visualizations: Suggest appropriate displays (table, stat, chart).
5. Return JSON Response: Output ONLY valid JSON matching the specified structure below.

## Output Format Specification
Return ONLY valid JSON with this structure:
\`\`\`json
{
  "display": [
    {
      "type": "table|stat|chart",
      "sql": "SELECT ... FROM ...\\nLEFT JOIN ...;",
      // ... type-specific properties
    },
    // ... additional visualizations
  ]
}
\`\`\`

### Visualization Types

#### 1. Data Tables
\`\`\`json
{
  "type": "table",
  "columns": {
    // you don't need to include all columns, just the ones you want to show in this table
    "database_column": "User-Friendly Label",
    "another_column": "Another Label"
  },
  "description": "What this table shows"
}
\`\`\`

#### 2. Statistical Metrics
\`\`\`json
{
  "type": "stat",
  "id": "column id from SQL",
  "name": "Title of stat card",
  "format": "Optional format string (e.g. '{0}%', '${0}')",
  "description": "What this metric represents"
}
\`\`\`

#### 3. Charts
\`\`\`json
{
  "type": "chart",
  "chartType": "bar|line|pie|scatter",
  "title": "Chart Title",
  "sql": "SQL query that returns data for this chart",
  "xAxis": {
    "column": "x_axis_column_name",
    "label": "X-Axis Label"
  },
  "yAxis": {
    "column": "y_axis_column_name",
    "label": "Y-Axis Label"
  },
  "description": "What this chart visualizes"
}
\`\`\`

## SQL Best Practices
- Use joins based on foreign keys.
- Handle NULLs (COALESCE, IS NULL).
- Use aliases.
- Add ORDER BY.

Remember: Output ONLY valid JSON.`;
	}

	createFollowupQueryPrompt(
		followupInstruction: string,
		previousContext: QueryContext,
		schemaDescription: string
	): string {
		const previousDisplaySummary = previousContext.display
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

					return `Display ${index + 1}: Stat "${statConfig.name}" (${statConfig.format || ''})
SQL: ${statConfig.sql}
Description: ${description}
Value: ${JSON.stringify(statConfig.results[0]?.[statConfig.id])}`;
				} else if (configType === 'chart') {
					const chartConfig = config as ChartDisplay & { results: Record<string, unknown>[] };

					return `Display ${index + 1}: Chart "${chartConfig.title}" (${chartConfig.chartType})
SQL: ${chartConfig.sql}
X-Axis: ${chartConfig.xAxis.column} (${chartConfig.xAxis.label})
Y-Axis: ${chartConfig.yAxis.column} (${chartConfig.yAxis.label})
${chartConfig.category ? `Category: ${chartConfig.category.column} (${chartConfig.category.label})` : ''}
Description: ${description}
Sample Data: ${JSON.stringify(chartConfig.results.slice(0, 2))}`;
				}
				return '';
			})
			.join('\n');

		return `You are an expert SQL engineer that translates natural language queries into PostgreSQL SQL.

DATABASE SCHEMA:
${schemaDescription}

PREVIOUS QUERY: "${previousContext.query}"

PREVIOUS RESULTS SUMMARY:
${previousDisplaySummary}

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
      "type": "table|stat|chart",
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
  "format": "Optional format string (e.g. '{0}%', '${0}')",
  "description": "What this stat represents"
}

3. For charts:
{
  "type": "chart",
  "chartType": "bar|line|pie|scatter",
  "title": "Chart Title",
  "sql": "SQL query that returns data for this chart",
  "xAxis": {
    "column": "x_axis_column_name",
    "label": "X-Axis Label"
  },
  "yAxis": {
    "column": "y_axis_column_name",
    "label": "Y-Axis Label"
  },
  "category": {
    "column": "optional_category_column",
    "label": "Category Label"
  },
  "description": "What this chart visualizes"
}

CHART TYPE GUIDANCE:
- Bar charts: Best for comparing values across categories
- Line charts: Best for time series and trend visualization
- Pie charts: Best for showing parts of a whole (proportions)
- Scatter plots: Best for showing correlation between two variables

IMPORTANT:
- Each display object MUST have its own SQL query
- Always use proper JOINs based on foreign key relationships
- Consider NULL values and use COALESCE when appropriate
- Use table aliases for complex queries
- Include relevant WHERE clauses for filtering
- Add comments to complex SQL for clarity
- Output ONLY valid JSON - no explanatory text before or after and no code fences`;
	}
}

import { Container, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { generateSQL } from '../openrouter';
import { getSchema, executeReadOnlyQuery, sampleRows, getTableRowCount } from '../db';

@injectable()
export class Api {
	private app: Hono;

	constructor() {
		this.app = new Hono().basePath('/api');
		this.setupRoutes();
	}

	private setupRoutes() {
		// Base route
		this.app.get('/', (c) => c.text('API Running'));

		// Query endpoint for natural language to SQL
		this.app.post('/query', async (c) => {
			try {
				// Get the query from the request body
				const body = await c.req.json();
				const query = body.query;
				const includeSamples = body.includeSamples !== false; // Default to true

				if (!query || typeof query !== 'string') {
					return c.json({ error: 'Query parameter is required' }, 400);
				}

				// Get the database schema
				const schema = await getSchema();

				// Collect sample data if requested
				let sampleData: Record<string, any[]> | undefined;
				if (includeSamples) {
					sampleData = {};
					// Get sample data for tables mentioned in the query or all tables if query is general
					const tableNames = Object.keys(schema);
					const samplePromises = tableNames.map(async (tableName) => {
						// Check if table is likely mentioned in the query, or sample a subset of tables
						// This is a simple heuristic and could be improved
						const isTableMentioned =
							query.toLowerCase().includes(tableName.toLowerCase()) || tableNames.length <= 5; // Sample all tables if we have few

						if (isTableMentioned) {
							try {
								// Get a small sample (3 rows) for context
								const samples = await sampleRows(tableName, 3);
								if (samples.length > 0) {
									sampleData![tableName] = samples;
								}
							} catch (err) {
								console.error(`Error sampling ${tableName}:`, err);
							}
						}
					});

					await Promise.all(samplePromises);
				}

				// Generate SQL using OpenRouter AI
				const { sql, display } = await generateSQL(query, schema, sampleData);

				// Execute the SQL safely (read-only, with timeout)
				const results = await executeReadOnlyQuery(sql);

				// Return the results along with the generated SQL and display information
				return c.json({
					query,
					sql,
					display,
					results
				});
			} catch (error) {
				console.error('Error processing query:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Schema endpoint to get database structure
		this.app.get('/schema', async (c) => {
			try {
				const schema = await getSchema();
				return c.json(schema);
			} catch (error) {
				console.error('Error fetching schema:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Sample endpoint to get example rows from a table
		this.app.get('/sample/:table', async (c) => {
			try {
				const table = c.req.param('table');
				const limitParam = c.req.query('limit');
				const limit = limitParam ? parseInt(limitParam, 10) : 5;

				if (isNaN(limit) || limit < 1 || limit > 10) {
					return c.json({ error: 'Invalid limit parameter. Must be between 1 and 10.' }, 400);
				}

				// Get random rows from the table
				const rows = await sampleRows(table, limit);
				return c.json(rows);
			} catch (error) {
				console.error('Error sampling table:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Enhanced tables endpoint - returns all available tables with row counts
		this.app.get('/tables', async (c) => {
			try {
				const schema = await getSchema();

				// Get table names
				const tableNames = Object.keys(schema);

				// Get row counts for each table
				const tableData = await Promise.all(
					tableNames.map(async (tableName) => {
						try {
							const count = await getTableRowCount(tableName);
							return {
								name: tableName,
								rowCount: count,
								columns: schema[tableName]
							};
						} catch (err) {
							console.error(`Error counting rows in ${tableName}:`, err);
							return {
								name: tableName,
								rowCount: null,
								columns: schema[tableName],
								error: 'Failed to count rows'
							};
						}
					})
				);

				return c.json(tableData);
			} catch (error) {
				console.error('Error fetching tables:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Data sampling tool endpoint - for AI to use when generating SQL
		this.app.post('/tool/sample-data', async (c) => {
			try {
				const body = await c.req.json();
				const { table, limit = 5 } = body;

				if (!table || typeof table !== 'string') {
					return c.json({ error: 'Table parameter is required' }, 400);
				}

				const sampleLimit = Math.min(Math.max(1, limit), 10);

				// Get random sample rows
				const rows = await sampleRows(table, sampleLimit);

				// Get table structure
				const schema = await getSchema();
				const tableSchema = schema[table] || [];

				return c.json({
					table,
					schema: tableSchema,
					sampleSize: rows.length,
					samples: rows
				});
			} catch (error) {
				console.error('Error sampling data:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});
	}

	public routes() {
		return this.app;
	}
}

export const routes = new Container().get(Api).routes();

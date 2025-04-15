import { Container, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { generateSQL } from '../openrouter';
import { executeReadOnlyQuery, getFullSchema } from '../db';

@injectable()
export class Api {
	private app: Hono;

	constructor() {
		this.app = new Hono().basePath('/api');
		this.setupRoutes();
	}

	private setupRoutes() {
		this.app.get('/', (c) => c.text('API Running'));

		this.app.post('/query', async (c) => {
			try {
				const body = await c.req.json();
				const query = body.query;

				if (!query || typeof query !== 'string') {
					return c.json({ error: 'Query parameter is required' }, 400);
				}

				const schema = await getFullSchema();

				const { sql, display } = await generateSQL(query, schema);

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
	}

	public routes() {
		return this.app;
	}
}

export const routes = new Container().get(Api).routes();

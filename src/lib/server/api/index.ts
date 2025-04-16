import { Container, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { generateSQL, generateSQLWithProgress, generateFollowupSQL } from '../openrouter';
import { executeReadOnlyQuery, getFullSchema } from '../postgres';
import { auth } from '../auth';

@injectable()
export class Api {
	private app: Hono;

	constructor() {
		this.app = new Hono().basePath('/api');
		this.setupRoutes();
	}

	private setupRoutes() {
		this.app.get('/', (c) => c.text('API Running'));

		this.app.on(['POST', 'GET'], '/auth/**', (c) => auth.handler(c.req.raw));

		this.app.post('/query', async (c) => {
			try {
				const body = await c.req.json();
				const query = body.query;

				if (!query || typeof query !== 'string') {
					return c.json({ error: 'Query parameter is required' }, 400);
				}

				const schema = await getFullSchema();

				const { display, explanation } = await generateSQL(query, schema);

				const displayWithResults = await Promise.all(
					display.map(async (config) => {
						const results = await executeReadOnlyQuery(config.sql);
						return {
							...config,
							results
						};
					})
				);

				return c.json({
					query,
					display: displayWithResults,
					explanation
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

		this.app.post('/query/stream', async (c) => {
			return streamText(c, async (stream) => {
				try {
					const body = await c.req.json();
					const query = body.query;

					if (!query || typeof query !== 'string') {
						await stream.writeln(
							JSON.stringify({
								error: 'Query parameter is required',
								status: 400
							})
						);
						return;
					}

					const schema = await getFullSchema();

					await stream.writeln(
						JSON.stringify({
							type: 'progress',
							message: 'Starting query processing'
						})
					);

					const { display, explanation } = await generateSQLWithProgress(
						query,
						schema,
						async (progress) => {
							await stream.writeln(
								JSON.stringify({
									type: 'progress',
									message: progress
								})
							);
						}
					);

					const displayWithResults = [];
					for (let i = 0; i < display.length; i++) {
						const config = display[i];
						await stream.writeln(
							JSON.stringify({
								type: 'progress',
								message: `Executing SQL query ${i + 1} of ${display.length}`
							})
						);

						const results = await executeReadOnlyQuery(config.sql);
						displayWithResults.push({
							...config,
							results
						});
					}

					await stream.writeln(
						JSON.stringify({
							type: 'result',
							data: {
								query,
								display: displayWithResults,
								explanation
							}
						})
					);
				} catch (error) {
					console.error('Error processing streaming query:', error);
					await stream.writeln(
						JSON.stringify({
							type: 'error',
							error: error instanceof Error ? error.message : 'Unknown error',
							status: 500
						})
					);
				}
			});
		});

		this.app.post('/query/followup/stream', async (c) => {
			return streamText(c, async (stream) => {
				try {
					const body = await c.req.json();
					const { followupInstruction, previousContext } = body;

					if (!followupInstruction || typeof followupInstruction !== 'string') {
						await stream.writeln(
							JSON.stringify({
								error: 'Followup instruction is required',
								status: 400
							})
						);
						return;
					}

					if (!previousContext || !previousContext.query || !previousContext.display) {
						await stream.writeln(
							JSON.stringify({
								error: 'Previous query context is required',
								status: 400
							})
						);
						return;
					}

					const schema = await getFullSchema();

					await stream.writeln(
						JSON.stringify({
							type: 'progress',
							message: 'Processing followup instruction'
						})
					);

					const { display, explanation } = await generateFollowupSQL(
						followupInstruction,
						previousContext,
						schema,
						async (progress) => {
							await stream.writeln(
								JSON.stringify({
									type: 'progress',
									message: progress
								})
							);
						}
					);

					const displayWithResults = [];
					for (let i = 0; i < display.length; i++) {
						const config = display[i];
						await stream.writeln(
							JSON.stringify({
								type: 'progress',
								message: `Executing SQL query ${i + 1} of ${display.length}`
							})
						);

						const results = await executeReadOnlyQuery(config.sql);
						displayWithResults.push({
							...config,
							results
						});
					}

					await stream.writeln(
						JSON.stringify({
							type: 'result',
							data: {
								query: followupInstruction,
								originalQuery: previousContext.query,
								display: displayWithResults,
								explanation
							}
						})
					);
				} catch (error) {
					console.error('Error processing streaming followup query:', error);
					await stream.writeln(
						JSON.stringify({
							type: 'error',
							error: error instanceof Error ? error.message : 'Unknown error',
							status: 500
						})
					);
				}
			});
		});
	}

	public routes() {
		return this.app;
	}
}

export const routes = new Container().get(Api).routes();

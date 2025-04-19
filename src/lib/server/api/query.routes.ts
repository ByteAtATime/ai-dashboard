import { inject, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import type { ProgressCallback } from '../interfaces/sql-generation.interface';
import type { DisplayConfig, QueryContext } from '../types/display.types';
import { SqlGenerationService } from '../services/sql-generation.service';
import { PostgresRepository } from '../repositories/postgres.repository';
import { DataSourceService } from '../services/datasource.service';

@injectable()
export class QueryRoutes {
	private app: Hono;

	constructor(
		private sqlGenerationService = inject(SqlGenerationService),
		private repository = inject(PostgresRepository),
		private dataSourceService = inject(DataSourceService)
	) {
		this.app = new Hono();
		this.setupRoutes();
	}

	private async getUserIdFromRequest(request: Request): Promise<string | null> {
		try {
			const { auth } = await import('../auth');
			const sessionResult = await auth.api.getSession({ headers: request.headers });
			if (sessionResult && sessionResult.user && sessionResult.user.id) {
				return sessionResult.user.id;
			}
			return null;
		} catch (error) {
			console.error('Error getting user session:', error);
			return null;
		}
	}

	private setupRoutes() {
		this.app.post('/', async (c) => {
			try {
				const body = await c.req.json();
				const query = body.query as string;
				const dataSourceId = body.dataSourceId as string;

				if (!query || typeof query !== 'string') {
					return c.json({ error: 'Query parameter is required' }, 400);
				}

				let connectionString = '';
				if (dataSourceId) {
					const userId = await this.getUserIdFromRequest(c.req.raw);
					if (!userId) {
						return c.json({ error: 'Unauthorized' }, 401);
					}
					const dataSource = await this.dataSourceService.getById(dataSourceId, userId);
					if (!dataSource) {
						return c.json({ error: 'Data source not found' }, 404);
					}
					connectionString = dataSource.connectionString;
				}

				const { display, explanation } = await this.sqlGenerationService.generateSql(query);

				const displayWithResults = await Promise.all(
					display.map(async (config: DisplayConfig) => {
						const results = await this.repository.executeReadOnlyQuery(
							config.sql,
							[],
							connectionString
						);
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

		this.app.post('/stream', async (c) => {
			return streamText(c, async (stream) => {
				try {
					const body = await c.req.json();
					const query = body.query as string;
					const dataSourceId = body.dataSourceId as string;

					if (!query || typeof query !== 'string') {
						await stream.writeln(
							JSON.stringify({
								error: 'Query parameter is required',
								status: 400
							})
						);
						return;
					}

					let connectionString = '';
					if (dataSourceId) {
						const userId = await this.getUserIdFromRequest(c.req.raw);
						if (!userId) {
							await stream.writeln(
								JSON.stringify({
									type: 'error',
									error: 'Unauthorized',
									status: 401
								})
							);
							return;
						}
						const dataSource = await this.dataSourceService.getById(dataSourceId, userId);
						if (!dataSource) {
							await stream.writeln(
								JSON.stringify({
									type: 'error',
									error: 'Data source not found',
									status: 404
								})
							);
							return;
						}
						connectionString = dataSource.connectionString;
					}

					await stream.writeln(
						JSON.stringify({
							type: 'progress',
							message: 'Starting query processing'
						})
					);

					const progressCallback: ProgressCallback = async (progress: string) => {
						await stream.writeln(
							JSON.stringify({
								type: 'progress',
								message: progress
							})
						);
					};

					const { display, explanation } = await this.sqlGenerationService.generateSql(
						query,
						progressCallback
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

						const results = await this.repository.executeReadOnlyQuery(
							config.sql,
							[],
							connectionString
						);
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

		this.app.post('/followup/stream', async (c) => {
			return streamText(c, async (stream) => {
				try {
					const body = await c.req.json();
					const bodyData = body as {
						followupInstruction: string;
						previousContext: QueryContext;
						dataSourceId: string;
					};

					const { followupInstruction, previousContext, dataSourceId } = bodyData;

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

					let connectionString = '';
					if (dataSourceId) {
						const userId = await this.getUserIdFromRequest(c.req.raw);
						if (!userId) {
							await stream.writeln(
								JSON.stringify({
									type: 'error',
									error: 'Unauthorized',
									status: 401
								})
							);
							return;
						}
						const dataSource = await this.dataSourceService.getById(dataSourceId, userId);
						if (!dataSource) {
							await stream.writeln(
								JSON.stringify({
									type: 'error',
									error: 'Data source not found',
									status: 404
								})
							);
							return;
						}
						connectionString = dataSource.connectionString;
					}

					await stream.writeln(
						JSON.stringify({
							type: 'progress',
							message: 'Processing followup instruction'
						})
					);

					const progressCallback: ProgressCallback = async (progress: string) => {
						await stream.writeln(
							JSON.stringify({
								type: 'progress',
								message: progress
							})
						);
					};

					const { display, explanation } = await this.sqlGenerationService.generateFollowupSql(
						followupInstruction,
						previousContext,
						progressCallback
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

						const results = await this.repository.executeReadOnlyQuery(
							config.sql,
							[],
							connectionString
						);
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

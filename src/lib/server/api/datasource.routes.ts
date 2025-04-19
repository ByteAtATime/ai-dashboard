import { inject, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { DataSourceService } from '../services/datasource.service';

@injectable()
export class DataSourceRoutes {
	private app: Hono;

	constructor(private dataSourceService = inject(DataSourceService)) {
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
		this.app.get('/', async (c) => {
			const userId = await this.getUserIdFromRequest(c.req.raw);

			if (!userId) {
				return c.json({ error: 'Unauthorized' }, 401);
			}

			const dataSources = await this.dataSourceService.getAllForUser(userId);
			return c.json(dataSources);
		});

		this.app.get('/:id', async (c) => {
			const userId = await this.getUserIdFromRequest(c.req.raw);

			if (!userId) {
				return c.json({ error: 'Unauthorized' }, 401);
			}

			const id = c.req.param('id');
			const dataSource = await this.dataSourceService.getById(id, userId);

			if (!dataSource) {
				return c.json({ error: 'Data source not found or unauthorized' }, 404);
			}

			return c.json(dataSource);
		});

		this.app.post('/', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const body = await c.req.json();

				if (!body.name || typeof body.name !== 'string') {
					return c.json({ error: 'Name is required' }, 400);
				}

				if (!body.connectionString || typeof body.connectionString !== 'string') {
					return c.json({ error: 'Connection string is required' }, 400);
				}

				const isDefault = body.isDefault === true;

				const dataSource = await this.dataSourceService.create({
					userId,
					name: body.name,
					connectionString: body.connectionString,
					isDefault
				});

				return c.json(dataSource, 201);
			} catch (error) {
				console.error('Error creating data source:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		this.app.put('/:id', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const id = c.req.param('id');
				const body = await c.req.json();

				const updateData: {
					name?: string;
					connectionString?: string;
					isDefault?: boolean;
				} = {};

				if (body.name !== undefined) updateData.name = body.name;
				if (body.connectionString !== undefined)
					updateData.connectionString = body.connectionString;
				if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;

				const updatedDataSource = await this.dataSourceService.update(id, userId, updateData);

				if (!updatedDataSource) {
					return c.json({ error: 'Data source not found or unauthorized' }, 404);
				}

				return c.json(updatedDataSource);
			} catch (error) {
				console.error('Error updating data source:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		this.app.delete('/:id', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const id = c.req.param('id');
				const success = await this.dataSourceService.delete(id, userId);

				if (!success) {
					return c.json({ error: 'Data source not found or unauthorized' }, 404);
				}

				return c.json({ success: true });
			} catch (error) {
				console.error('Error deleting data source:', error);
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

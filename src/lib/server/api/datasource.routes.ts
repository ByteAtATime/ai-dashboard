import { inject, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { DataSourceService } from '../services/datasource.service';
import type { AppEnv } from '.';
import { ForbiddenError } from '../errors';

@injectable()
export class DataSourceRoutes {
	private app: Hono<AppEnv>;

	constructor(private dataSourceService = inject(DataSourceService)) {
		this.app = new Hono();
	}

	public routes() {
		return this.app
			.get('/', async (c) => {
				const organizationId = c.var.user?.activeOrganizationId;

				if (!organizationId) {
					return c.json({ error: 'No active organization selected' }, 403);
				}

				const dataSources = await this.dataSourceService.getAllForOrganization(organizationId);
				return c.json(dataSources);
			})
			.get('/:id', async (c) => {
				const organizationId = c.var.user?.activeOrganizationId;

				if (!organizationId) {
					return c.json({ error: 'No active organization selected' }, 403);
				}

				const id = c.req.param('id');
				try {
					const dataSource = await this.dataSourceService.getDataSourceById(id, organizationId);
					return c.json(dataSource);
				} catch (error) {
					if (error instanceof ForbiddenError) {
						return c.json({ error: 'Data source not found or unauthorized' }, 404);
					}
					console.error('Error fetching data source:', error);
					return c.json({ error: 'Internal Server Error' }, 500);
				}
			})
			.post('/', async (c) => {
				try {
					const userId = c.var.user?.id;
					const organizationId = c.var.user?.activeOrganizationId;

					if (!userId) {
						return c.json({ error: 'Unauthorized' }, 401);
					}
					if (!organizationId) {
						return c.json({ error: 'No active organization selected' }, 403);
					}

					const body = await c.req.json();

					if (!body.name || typeof body.name !== 'string') {
						return c.json({ error: 'Name is required' }, 400);
					}

					if (!body.connectionString || typeof body.connectionString !== 'string') {
						return c.json({ error: 'Connection string is required' }, 400);
					}

					const dataSource = await this.dataSourceService.create({
						userId,
						organizationId,
						name: body.name,
						connectionString: body.connectionString
					});

					return c.json(dataSource, 201);
				} catch (error) {
					console.error('Error creating data source:', error);
					const statusCode = error instanceof ForbiddenError ? 403 : 500;
					return c.json(
						{
							error: error instanceof Error ? error.message : 'Unknown error'
						},
						statusCode
					);
				}
			})
			.put('/:id', async (c) => {
				try {
					const organizationId = c.var.user?.activeOrganizationId;

					if (!organizationId) {
						return c.json({ error: 'No active organization selected' }, 403);
					}

					const id = c.req.param('id');
					const body = await c.req.json();

					const updateData: {
						name?: string;
						connectionString?: string;
					} = {};

					if (body.name !== undefined) updateData.name = body.name;
					if (body.connectionString !== undefined)
						updateData.connectionString = body.connectionString;

					const updatedDataSource = await this.dataSourceService.update(
						id,
						organizationId,
						updateData
					);

					return c.json(updatedDataSource);
				} catch (error) {
					console.error('Error updating data source:', error);
					if (error instanceof ForbiddenError) {
						return c.json({ error: 'Data source not found or unauthorized' }, 404);
					}
					return c.json(
						{
							error: error instanceof Error ? error.message : 'Unknown error'
						},
						500
					);
				}
			})
			.delete('/:id', async (c) => {
				try {
					const organizationId = c.var.user?.activeOrganizationId;

					if (!organizationId) {
						return c.json({ error: 'No active organization selected' }, 403);
					}

					const id = c.req.param('id');
					await this.dataSourceService.delete(id, organizationId);

					return c.json({ success: true });
				} catch (error) {
					console.error('Error deleting data source:', error);
					if (error instanceof ForbiddenError) {
						return c.json({ error: 'Data source not found or unauthorized' }, 404);
					}
					return c.json(
						{
							error: error instanceof Error ? error.message : 'Unknown error'
						},
						500
					);
				}
			});
	}
}

export type DataSourceRoutesType = ReturnType<DataSourceRoutes['routes']>;

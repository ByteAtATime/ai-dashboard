import { inject, injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { IDashboardService } from '../interfaces/services/dashboard.service.interface';
import type { AppEnv } from '.';
import { DashboardService } from '../services/dashboard.service';
import {
	updateDashboardSchema,
	updateDashboardItemSchema,
	insertDashboardItemSchema,
	insertFullDashboardSchema
} from '../types/dashboard.types';
import { NotFoundError, ForbiddenError } from '../errors';

@injectable()
export class DashboardRoutes {
	private app: Hono<AppEnv>;

	constructor(private dashboardService: IDashboardService = inject(DashboardService)) {
		this.app = new Hono();
		this.setupRoutes();
	}

	private setupRoutes() {
		const app = this.app;

		app.use('*', async (c, next) => {
			const user = c.get('user');
			if (!user) {
				return c.json({ error: 'Unauthorized' }, 401);
			}
			await next();
		});

		app.use('*', async (c, next) => {
			const organizationId = c.var.user?.activeOrganizationId;
			if (!organizationId) {
				return c.json({ error: 'No active organization selected' }, 403);
			}
			await next();
		});

		app.get('/', async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			try {
				const dashboards = await this.dashboardService.getDashboardsForOrganization(organizationId);
				return c.json(dashboards);
			} catch (error) {
				console.error('Error fetching dashboards:', error);
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.post(
			'/',
			zValidator('json', insertFullDashboardSchema.omit({ userId: true })),
			async (c) => {
				const userId = c.var.user!.id;
				const organizationId = c.var.user!.activeOrganizationId!;
				const validatedData = c.req.valid('json');

				try {
					const newDashboard = await this.dashboardService.createDashboard({
						...validatedData,
						userId,
						organizationId
					});
					return c.json(newDashboard, 201);
				} catch (error) {
					console.error('Error creating dashboard:', error);
					if (error instanceof ForbiddenError) {
						return c.json({ error: error.message || 'Forbidden' }, 403);
					}
					return c.json({ error: 'Internal Server Error' }, 500);
				}
			}
		);

		app.get('/:id', async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const id = c.req.param('id');
			try {
				const dashboard = await this.dashboardService.getDashboardById(id, organizationId);
				if (!dashboard) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				return c.json(dashboard);
			} catch (error) {
				console.error(`Error fetching dashboard ${id}:`, error);
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.put('/:id', zValidator('json', updateDashboardSchema), async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const id = c.req.param('id');
			const validatedData = c.req.valid('json');

			if (Object.keys(validatedData).length === 0) {
				return c.json({ error: 'No fields provided for update' }, 400);
			}

			try {
				const updatedDashboard = await this.dashboardService.updateDashboard(
					id,
					organizationId,
					validatedData
				);
				if (!updatedDashboard) {
					return c.json({ error: 'Dashboard not found or no changes made' }, 404);
				}
				return c.json(updatedDashboard);
			} catch (error) {
				console.error(`Error updating dashboard ${id}:`, error);
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard not found or cannot update' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.delete('/:id', async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const id = c.req.param('id');
			try {
				const success = await this.dashboardService.deleteDashboard(id, organizationId);
				if (!success) {
					return c.json({ error: 'Dashboard not found or cannot delete' }, 404);
				}
				return c.body(null, 204);
			} catch (error) {
				console.error(`Error deleting dashboard ${id}:`, error);
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard not found or cannot delete' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.post('/:dashboardId/items', zValidator('json', insertDashboardItemSchema), async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const dashboardId = c.req.param('dashboardId');
			const validatedData = c.req.valid('json');
			try {
				const newItem = await this.dashboardService.addDashboardItem(
					dashboardId,
					organizationId,
					validatedData
				);
				return c.json(newItem, 201);
			} catch (error) {
				console.error(`Error adding item to dashboard ${dashboardId}:`, error);
				if (error instanceof NotFoundError || error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard not found or forbidden' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.put('/items/:itemId', zValidator('json', updateDashboardItemSchema), async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const itemId = c.req.param('itemId');
			const validatedData = c.req.valid('json');

			if (Object.keys(validatedData).length === 0) {
				return c.json({ error: 'No fields provided for update' }, 400);
			}

			try {
				const updatedItem = await this.dashboardService.updateDashboardItem(
					itemId,
					organizationId,
					validatedData
				);
				if (!updatedItem) {
					return c.json({ error: 'Dashboard item not found or forbidden' }, 404);
				}
				return c.json(updatedItem);
			} catch (error) {
				console.error(`Error updating dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError || error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard item not found or forbidden' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.delete('/items/:itemId', async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const itemId = c.req.param('itemId');
			try {
				const success = await this.dashboardService.deleteDashboardItem(itemId, organizationId);
				if (!success) {
					return c.json({ error: 'Dashboard item not found or forbidden' }, 404);
				}
				return c.body(null, 204);
			} catch (error) {
				console.error(`Error deleting dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError || error instanceof ForbiddenError) {
					return c.json({ error: 'Dashboard item not found or forbidden' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.post('/items/:itemId/refresh', async (c) => {
			const organizationId = c.var.user!.activeOrganizationId!;
			const itemId = c.req.param('itemId');
			try {
				const executionResult = await this.dashboardService.refreshDashboardItem(
					itemId,
					organizationId
				);
				return c.json(executionResult);
			} catch (error) {
				console.error(`Error refreshing dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError || error instanceof ForbiddenError) {
					return c.json({ error: error.message || 'Not found or forbidden' }, 404);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});
	}

	public routes() {
		return this.app;
	}
}

export type DashboardAppType = ReturnType<DashboardRoutes['routes']>;

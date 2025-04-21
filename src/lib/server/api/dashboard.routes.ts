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

class NotFoundError extends Error {
	constructor(message = 'Resource not found') {
		super(message);
		this.name = 'NotFoundError';
	}
}
class ForbiddenError extends Error {
	constructor(message = 'Forbidden') {
		super(message);
		this.name = 'ForbiddenError';
	}
}

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

		app.get('/', async (c) => {
			const userId = c.var.user!.id;
			try {
				const dashboards = await this.dashboardService.getDashboardsForUser(userId);
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
				const validatedData = { ...c.req.valid('json'), userId: c.var.user!.id };
				try {
					const newDashboard = await this.dashboardService.createDashboard(validatedData);
					return c.json(newDashboard, 201);
				} catch (error) {
					console.error('Error creating dashboard:', error);
					if (error instanceof ForbiddenError) {
						return c.json({ error: 'Invalid data source specified' }, 403);
					}
					return c.json({ error: 'Internal Server Error' }, 500);
				}
			}
		);

		app.get('/:id', async (c) => {
			const userId = c.var.user!.id;
			const id = c.req.param('id');
			try {
				const dashboard = await this.dashboardService.getDashboardById(id, userId);
				if (!dashboard) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				return c.json(dashboard);
			} catch (error) {
				console.error(`Error fetching dashboard ${id}:`, error);
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.put('/:id', zValidator('json', updateDashboardSchema), async (c) => {
			const userId = c.var.user!.id;
			const id = c.req.param('id');
			const validatedData = c.req.valid('json');

			if (Object.keys(validatedData).length === 0) {
				return c.json({ error: 'No fields provided for update' }, 400);
			}

			try {
				const updatedDashboard = await this.dashboardService.updateDashboard(
					id,
					userId,
					validatedData
				);
				if (!updatedDashboard) {
					return c.json({ error: 'Dashboard not found or no changes made' }, 404);
				}
				return c.json(updatedDashboard);
			} catch (error) {
				console.error(`Error updating dashboard ${id}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.delete('/:id', async (c) => {
			const userId = c.var.user!.id;
			const id = c.req.param('id');
			try {
				const success = await this.dashboardService.deleteDashboard(id, userId);
				if (!success) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				return c.body(null, 204);
			} catch (error) {
				console.error(`Error deleting dashboard ${id}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.post('/:dashboardId/items', zValidator('json', insertDashboardItemSchema), async (c) => {
			const userId = c.var.user!.id;
			const dashboardId = c.req.param('dashboardId');
			const validatedData = c.req.valid('json');
			try {
				const newItem = await this.dashboardService.addDashboardItem(
					dashboardId,
					userId,
					validatedData
				);
				return c.json(newItem, 201);
			} catch (error) {
				console.error(`Error adding item to dashboard ${dashboardId}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.put('/items/:itemId', zValidator('json', updateDashboardItemSchema), async (c) => {
			const userId = c.var.user!.id;
			const itemId = c.req.param('itemId');
			const validatedData = c.req.valid('json');

			if (Object.keys(validatedData).length === 0) {
				return c.json({ error: 'No fields provided for update' }, 400);
			}

			try {
				const updatedItem = await this.dashboardService.updateDashboardItem(
					itemId,
					userId,
					validatedData
				);
				if (!updatedItem) {
					return c.json({ error: 'Dashboard item not found or no changes made' }, 404);
				}
				return c.json(updatedItem);
			} catch (error) {
				console.error(`Error updating dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard item not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.delete('/items/:itemId', async (c) => {
			const userId = c.var.user!.id;
			const itemId = c.req.param('itemId');
			try {
				const success = await this.dashboardService.deleteDashboardItem(itemId, userId);
				if (!success) {
					return c.json({ error: 'Dashboard item not found' }, 404);
				}
				return c.body(null, 204);
			} catch (error) {
				console.error(`Error deleting dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard item not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
				}
				return c.json({ error: 'Internal Server Error' }, 500);
			}
		});

		app.post('/items/:itemId/refresh', async (c) => {
			const userId = c.var.user!.id;
			const itemId = c.req.param('itemId');
			try {
				const executionResult = await this.dashboardService.refreshDashboardItem(itemId, userId);
				return c.json(executionResult);
			} catch (error) {
				console.error(`Error refreshing dashboard item ${itemId}:`, error);
				if (error instanceof NotFoundError) {
					return c.json({ error: 'Dashboard item not found' }, 404);
				}
				if (error instanceof ForbiddenError) {
					return c.json({ error: 'Forbidden' }, 403);
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

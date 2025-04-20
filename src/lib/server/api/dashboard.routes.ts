import { injectable } from '@needle-di/core';
import { Hono } from 'hono';
import { dashboards } from '../db/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';

@injectable()
export class DashboardRoutes {
	private app: Hono;

	constructor() {
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
		// Save dashboard endpoint
		this.app.post('/', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const body = await c.req.json();
				const { name, query, display, explanation, visibility } = body;

				if (!name || !query || !display) {
					return c.json({ error: 'Name, query, and display data are required' }, 400);
				}

				const [dashboard] = await db
					.insert(dashboards)
					.values({
						userId,
						name,
						query,
						displayData: display,
						explanation: explanation || null,
						visibility: visibility === 'public' ? 'public' : 'private' // Default to private
					})
					.returning();

				return c.json({
					message: 'Dashboard saved successfully',
					dashboard
				});
			} catch (error) {
				console.error('Error saving dashboard:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Get all dashboards for the authenticated user
		this.app.get('/', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const allDashboards = await db
					.select({
						id: dashboards.id,
						name: dashboards.name,
						createdAt: dashboards.createdAt
					})
					.from(dashboards)
					.where(eq(dashboards.userId, userId));

				return c.json(allDashboards);
			} catch (error) {
				console.error('Error fetching dashboards:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Get dashboard by ID
		this.app.get('/:id', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw); // Can be null for public dashboards
				const id = c.req.param('id');

				const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));

				if (!dashboard) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}

				// Check permissions
				if (dashboard.visibility === 'private') {
					if (!userId || dashboard.userId !== userId) {
						return c.json({ error: 'Dashboard not found or unauthorized' }, 404);
					}
				} // Public dashboards are accessible to anyone

				return c.json(dashboard);
			} catch (error) {
				console.error('Error fetching dashboard:', error);
				return c.json(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						status: 500
					},
					500
				);
			}
		});

		// Update dashboard by ID (only if owned by the authenticated user)
		this.app.put('/:id', async (c) => {
			try {
				const userId = await this.getUserIdFromRequest(c.req.raw);
				const id = c.req.param('id');

				if (!userId) {
					return c.json({ error: 'Unauthorized' }, 401);
				}

				const body = await c.req.json();
				const { name, query, display, explanation, visibility } = body;

				// Fetch the dashboard first to ensure ownership
				const [existingDashboard] = await db
					.select({ userId: dashboards.userId })
					.from(dashboards)
					.where(eq(dashboards.id, id));

				if (!existingDashboard) {
					return c.json({ error: 'Dashboard not found' }, 404);
				}

				if (existingDashboard.userId !== userId) {
					return c.json({ error: 'Unauthorized to update this dashboard' }, 403);
				}

				// Prepare updates - only include fields that are provided in the body
				const updates: Partial<typeof dashboards.$inferInsert> = {};
				if (name !== undefined) updates.name = name;
				if (query !== undefined) updates.query = query;
				if (display !== undefined) updates.displayData = display;
				if (explanation !== undefined) updates.explanation = explanation;
				if (visibility === 'public' || visibility === 'private') {
					updates.visibility = visibility;
				}

				if (Object.keys(updates).length === 0) {
					return c.json({ error: 'No fields provided for update' }, 400);
				}

				const [updatedDashboard] = await db
					.update(dashboards)
					.set(updates)
					.where(and(eq(dashboards.id, id), eq(dashboards.userId, userId)))
					.returning();

				return c.json({
					message: 'Dashboard updated successfully',
					dashboard: updatedDashboard
				});
			} catch (error) {
				console.error('Error updating dashboard:', error);
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

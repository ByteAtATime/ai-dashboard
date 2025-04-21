import { injectable } from '@needle-di/core';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '$lib/server/db/schema';
import type { Dashboard, InsertDashboard } from '$lib/server/types/dashboard.types';
import type { IDashboardRepository } from '../interfaces/repositories/dashboard.repository.interface';

@injectable()
export class PostgresDashboardRepository implements IDashboardRepository {
	async findById(id: string): Promise<Dashboard | null> {
		const result = await db
			.select()
			.from(schema.dashboards)
			.where(eq(schema.dashboards.id, id))
			.limit(1);
		return result[0] ?? null;
	}

	async findByUserId(userId: string): Promise<Dashboard[]> {
		return db
			.select()
			.from(schema.dashboards)
			.where(eq(schema.dashboards.userId, userId))
			.orderBy(desc(schema.dashboards.createdAt));
	}

	async create(data: InsertDashboard): Promise<Dashboard> {
		const [newDashboard] = await db
			.insert(schema.dashboards)
			.values({
				...data
			})
			.returning();
		return newDashboard;
	}

	async update(
		id: string,
		data: Partial<Pick<Dashboard, 'name' | 'visibility'>>
	): Promise<Dashboard | null> {
		const [updatedDashboard] = await db
			.update(schema.dashboards)
			.set({
				...data
			})
			.where(eq(schema.dashboards.id, id))
			.returning();
		return updatedDashboard ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const deleted = await db
			.delete(schema.dashboards)
			.where(eq(schema.dashboards.id, id))
			.returning({ id: schema.dashboards.id });
		return deleted.length > 0;
	}
}

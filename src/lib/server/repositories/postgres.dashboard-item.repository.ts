import { injectable } from '@needle-di/core';
import { eq, desc } from 'drizzle-orm';

import * as schema from '$lib/server/db/schema';
import type { DashboardItem } from '$lib/server/types/dashboard.types';
import type { IDashboardItemRepository } from '../interfaces/repositories/dashboard-item.repository.interface';
import { db } from '../db';

@injectable()
export class PostgresDashboardItemRepository implements IDashboardItemRepository {
	async findById(id: string): Promise<DashboardItem | null> {
		const result = (await db
			.select()
			.from(schema.dashboardItems)
			.where(eq(schema.dashboardItems.id, id))
			.limit(1)) as DashboardItem[];
		return result[0] ?? null;
	}

	async findByDashboardId(dashboardId: string): Promise<DashboardItem[]> {
		return (await db
			.select()
			.from(schema.dashboardItems)
			.where(eq(schema.dashboardItems.dashboardId, dashboardId))
			.orderBy(desc(schema.dashboardItems.createdAt))) as DashboardItem[];
	}

	async create(
		data: Omit<DashboardItem, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<DashboardItem> {
		const [newItem] = (await db
			.insert(schema.dashboardItems)
			.values(data)
			.returning()) as DashboardItem[];
		return newItem;
	}

	async update(
		id: string,
		data: Partial<Omit<DashboardItem, 'id' | 'createdAt' | 'updatedAt' | 'dashboardId'>>
	): Promise<DashboardItem | null> {
		const [updatedItem] = (await db
			.update(schema.dashboardItems)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(schema.dashboardItems.id, id))
			.returning()) as DashboardItem[];
		return updatedItem ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const deleted = await db
			.delete(schema.dashboardItems)
			.where(eq(schema.dashboardItems.id, id))
			.returning({ id: schema.dashboardItems.id });
		return deleted.length > 0;
	}

	async deleteByDashboardId(dashboardId: string): Promise<boolean> {
		const deleted = await db
			.delete(schema.dashboardItems)
			.where(eq(schema.dashboardItems.dashboardId, dashboardId))
			.returning({ id: schema.dashboardItems.id });

		return deleted.length > 0;
	}
}

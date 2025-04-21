import { injectable } from '@needle-di/core';
import { eq, desc, and } from 'drizzle-orm';

import * as schema from '$lib/server/db/schema';
import type { DashboardItemExecution } from '$lib/server/types/dashboard.types';
import type { IDashboardItemExecutionRepository } from '../interfaces/repositories/dashboard-item-execution.repository.interface';
import { db } from '../db';

@injectable()
export class PostgresDashboardItemExecutionRepository implements IDashboardItemExecutionRepository {
	async findById(id: string): Promise<DashboardItemExecution | null> {
		const result = (await db
			.select()
			.from(schema.dashboardItemExecutions)
			.where(eq(schema.dashboardItemExecutions.id, id))
			.limit(1)) as DashboardItemExecution[];
		return result[0] ?? null;
	}

	async findByItemId(itemId: string): Promise<DashboardItemExecution[]> {
		return (await db
			.select()
			.from(schema.dashboardItemExecutions)
			.where(eq(schema.dashboardItemExecutions.dashboardItemId, itemId))
			.orderBy(desc(schema.dashboardItemExecutions.executedAt))) as DashboardItemExecution[];
	}

	async findLatestByItemId(itemId: string): Promise<DashboardItemExecution | null> {
		const result = (await db
			.select()
			.from(schema.dashboardItemExecutions)
			.where(eq(schema.dashboardItemExecutions.dashboardItemId, itemId))
			.orderBy(desc(schema.dashboardItemExecutions.executedAt))
			.limit(1)) as DashboardItemExecution[];
		return result[0] ?? null;
	}

	async findLatestSuccessfulByItemId(itemId: string): Promise<DashboardItemExecution | null> {
		const result = (await db
			.select()
			.from(schema.dashboardItemExecutions)
			.where(
				and(
					eq(schema.dashboardItemExecutions.dashboardItemId, itemId),
					eq(schema.dashboardItemExecutions.status, 'success')
				)
			)
			.orderBy(desc(schema.dashboardItemExecutions.executedAt))
			.limit(1)) as DashboardItemExecution[];
		return result[0] ?? null;
	}

	async create(data: Omit<DashboardItemExecution, 'id'>): Promise<DashboardItemExecution> {
		const [newExecution] = (await db
			.insert(schema.dashboardItemExecutions)
			.values(data)
			.returning()) as DashboardItemExecution[];
		return newExecution;
	}

	async update(
		id: string,
		data: Partial<Pick<DashboardItemExecution, 'status' | 'results' | 'errorMessage'>>
	): Promise<DashboardItemExecution | null> {
		const [updatedExecution] = (await db
			.update(schema.dashboardItemExecutions)
			.set(data)
			.where(eq(schema.dashboardItemExecutions.id, id))
			.returning()) as DashboardItemExecution[];
		return updatedExecution ?? null;
	}

	async deleteByItemId(itemId: string): Promise<boolean> {
		const deleted = await db
			.delete(schema.dashboardItemExecutions)
			.where(eq(schema.dashboardItemExecutions.dashboardItemId, itemId))
			.returning({ id: schema.dashboardItemExecutions.id });
		return deleted.length > 0;
	}
}

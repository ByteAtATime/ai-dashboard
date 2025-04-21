import type { DashboardItemExecution } from '$lib/server/types/dashboard.types';

export interface IDashboardItemExecutionRepository {
	findById(id: string): Promise<DashboardItemExecution | null>;

	findByItemId(itemId: string): Promise<DashboardItemExecution[]>;

	findLatestByItemId(itemId: string): Promise<DashboardItemExecution | null>;

	findLatestSuccessfulByItemId(itemId: string): Promise<DashboardItemExecution | null>;

	create(data: Omit<DashboardItemExecution, 'id'>): Promise<DashboardItemExecution>;

	update(
		id: string,
		data: Partial<Pick<DashboardItemExecution, 'status' | 'results' | 'errorMessage'>>
	): Promise<DashboardItemExecution | null>;

	deleteByItemId(itemId: string): Promise<boolean>;
}

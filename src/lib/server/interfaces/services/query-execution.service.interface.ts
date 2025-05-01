import type { DashboardItemExecution } from '$lib/server/types/dashboard.types';

export interface IQueryExecutionService {
	executeQuery(
		sql: string,
		connectionString: string,
		dashboardItemId?: string
	): Promise<DashboardItemExecution>;
}

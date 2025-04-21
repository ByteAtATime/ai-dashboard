import type {
	Dashboard,
	FullDashboard,
	DashboardItem,
	DashboardItemExecution,
	InsertFullDashboard,
	InsertDashboardItem,
	UpdateDashboard,
	UpdateDashboardItem
} from '$lib/server/types/dashboard.types';

export interface IDashboardService {
	getDashboardsForUser(userId: string): Promise<Dashboard[]>;

	getDashboardById(dashboardId: string, userId: string): Promise<FullDashboard | null>;

	createDashboard(data: InsertFullDashboard): Promise<FullDashboard>;

	updateDashboard(
		dashboardId: string,
		userId: string,
		data: UpdateDashboard
	): Promise<Dashboard | null>;

	deleteDashboard(dashboardId: string, userId: string): Promise<boolean>;

	addDashboardItem(
		dashboardId: string,
		userId: string,
		itemData: InsertDashboardItem
	): Promise<DashboardItem>;

	updateDashboardItem(
		itemId: string,
		userId: string,
		itemData: UpdateDashboardItem
	): Promise<DashboardItem | null>;

	deleteDashboardItem(itemId: string, userId: string): Promise<boolean>;

	refreshDashboardItem(itemId: string, userId: string): Promise<DashboardItemExecution>;
}

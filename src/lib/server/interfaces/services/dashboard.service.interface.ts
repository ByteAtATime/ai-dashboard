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
	getDashboardsForOrganization(organizationId: string): Promise<Dashboard[]>;

	getDashboardById(dashboardId: string, organizationId: string): Promise<FullDashboard | null>;

	createDashboard(data: InsertFullDashboard & { organizationId: string }): Promise<FullDashboard>;

	updateDashboard(
		dashboardId: string,
		organizationId: string,
		data: UpdateDashboard
	): Promise<Dashboard | null>;

	deleteDashboard(dashboardId: string, organizationId: string): Promise<boolean>;

	addDashboardItem(
		dashboardId: string,
		organizationId: string,
		itemData: InsertDashboardItem
	): Promise<DashboardItem>;

	updateDashboardItem(
		itemId: string,
		organizationId: string,
		itemData: UpdateDashboardItem
	): Promise<DashboardItem | null>;

	deleteDashboardItem(itemId: string, organizationId: string): Promise<boolean>;

	refreshDashboardItem(itemId: string, organizationId: string): Promise<DashboardItemExecution>;
}

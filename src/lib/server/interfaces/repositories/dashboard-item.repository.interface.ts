import type {
	DashboardItem,
	InsertDashboardItem,
	UpdateDashboardItem
} from '$lib/server/types/dashboard.types';

export interface IDashboardItemRepository {
	findById(id: string): Promise<DashboardItem | null>;
	findByDashboardId(dashboardId: string): Promise<DashboardItem[]>;

	create(data: InsertDashboardItem): Promise<DashboardItem>;
	update(id: string, data: UpdateDashboardItem): Promise<DashboardItem | null>;
	delete(id: string): Promise<boolean>;
	deleteByDashboardId(dashboardId: string): Promise<boolean>;
}

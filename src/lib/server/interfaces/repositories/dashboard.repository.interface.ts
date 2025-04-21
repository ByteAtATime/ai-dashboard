import type {
	Dashboard,
	InsertDashboard,
	UpdateDashboard
} from '$lib/server/types/dashboard.types';

export interface IDashboardRepository {
	findById(id: string): Promise<Dashboard | null>;
	findByUserId(userId: string): Promise<Dashboard[]>;
	create(data: InsertDashboard): Promise<Dashboard>;
	update(id: string, data: UpdateDashboard): Promise<Dashboard | null>;
	delete(id: string): Promise<boolean>;
}

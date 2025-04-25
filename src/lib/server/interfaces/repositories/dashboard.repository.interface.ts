import type {
	Dashboard,
	InsertDashboard,
	UpdateDashboard
} from '$lib/server/types/dashboard.types';

export interface IDashboardRepository {
	findById(id: string): Promise<Dashboard | null>;
	findByOrganizationId(organizationId: string): Promise<Dashboard[]>;
	create(data: InsertDashboard & { organizationId: string }): Promise<Dashboard>;
	update(id: string, data: UpdateDashboard): Promise<Dashboard | null>;
	delete(id: string): Promise<boolean>;
}

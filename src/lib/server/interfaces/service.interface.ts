import type { DataSource } from '../types/datasource.types';

export interface IDataSourceService {
	getAllForOrganization(organizationId: string): Promise<DataSource[]>;
	getById(id: string, organizationId: string): Promise<DataSource | null>;
	getDataSourceById(dataSourceId: string, organizationId: string): Promise<DataSource | null>;
	create(data: {
		userId: string;
		organizationId: string;
		name: string;
		connectionString: string;
	}): Promise<DataSource | null>;
	update(
		id: string,
		organizationId: string,
		data: {
			name?: string;
			connectionString?: string;
		}
	): Promise<DataSource | null>;
	delete(id: string, organizationId: string): Promise<boolean>;
}

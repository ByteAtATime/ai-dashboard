import type { DataSource } from '../types/datasource.types';

export interface IDataSourceService {
	getAllForUser(userId: string): Promise<DataSource[]>;
	getById(id: string, userId: string): Promise<DataSource | null>;
	getDefaultForUser(userId: string): Promise<DataSource | null>;
	create(data: {
		userId: string;
		name: string;
		connectionString: string;
		isDefault?: boolean;
	}): Promise<DataSource | null>;
	update(
		id: string,
		userId: string,
		data: {
			name?: string;
			connectionString?: string;
			isDefault?: boolean;
		}
	): Promise<DataSource | null>;
	delete(id: string, userId: string): Promise<boolean>;
}

import type { DatabaseSchema } from '../types/db.types';
import type { DataSource } from '../types/datasource.types';

export interface IRepository {
	executeReadOnlyQuery(
		sql: string,
		connectionString: string,
		params?: unknown[]
	): Promise<Record<string, unknown>[]>;
	sampleTable(
		tableName: string,
		numRows: number,
		connectionString: string
	): Promise<Record<string, unknown>[]>;
	getFullSchema(connectionString: string): Promise<DatabaseSchema>;
}

export interface IDataSourceRepository {
	getAllForOrganization(organizationId: string): Promise<DataSource[]>;
	getById(id: string): Promise<DataSource | null>;
	create(data: {
		userId: string;
		organizationId: string;
		name: string;
		connectionString: string;
	}): Promise<DataSource | null>;
	update(
		id: string,
		data: {
			name?: string;
			connectionString?: string;
		}
	): Promise<DataSource | null>;
	delete(id: string): Promise<boolean>;
}

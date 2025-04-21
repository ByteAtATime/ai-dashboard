import type { DataSource } from '../repositories/datasource.repository.interface';

export interface IDataSourceService {
	getDataSourceById(dataSourceId: string, userId: string): Promise<DataSource | null>;
}

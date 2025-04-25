import { inject, injectable } from '@needle-di/core';
import type { IDataSourceService } from '../interfaces/service.interface';
import type { DataSource } from '../types/datasource.types';
import { DataSourceRepository } from '../repositories/datasource.repository';
import { ForbiddenError } from '../errors';

@injectable()
export class DataSourceService implements IDataSourceService {
	constructor(private repository = inject(DataSourceRepository)) {}

	async getAllForOrganization(organizationId: string): Promise<DataSource[]> {
		return this.repository.getAllForOrganization(organizationId);
	}

	async getById(id: string, organizationId: string): Promise<DataSource | null> {
		const dataSource = await this.repository.getById(id);
		if (!dataSource || dataSource.organizationId !== organizationId) {
			return null;
		}
		return dataSource;
	}

	async getDataSourceById(
		dataSourceId: string,
		organizationId: string
	): Promise<DataSource | null> {
		const dataSource = await this.repository.getById(dataSourceId);
		if (!dataSource || dataSource.organizationId !== organizationId) {
			throw new ForbiddenError('User does not have access to this data source');
		}
		return dataSource;
	}

	async create(data: {
		userId: string;
		organizationId: string;
		name: string;
		connectionString: string;
	}): Promise<DataSource | null> {
		return this.repository.create(data);
	}

	async update(
		id: string,
		organizationId: string,
		data: {
			name?: string;
			connectionString?: string;
		}
	): Promise<DataSource | null> {
		const existing = await this.repository.getById(id);
		if (!existing || existing.organizationId !== organizationId) {
			throw new ForbiddenError('Data source not found or access denied.');
		}

		const updated = await this.repository.update(id, data);
		return updated;
	}

	async delete(id: string, organizationId: string): Promise<boolean> {
		const existing = await this.repository.getById(id);
		if (!existing || existing.organizationId !== organizationId) {
			throw new ForbiddenError('Data source not found or access denied.');
		}

		return this.repository.delete(id);
	}
}

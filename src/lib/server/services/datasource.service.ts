import { inject, injectable } from '@needle-di/core';
import type { IDataSourceService } from '../interfaces/service.interface';
import type { DataSource } from '../types/datasource.types';
import { DataSourceRepository } from '../repositories/datasource.repository';

@injectable()
export class DataSourceService implements IDataSourceService {
	constructor(private repository = inject(DataSourceRepository)) {}

	async getAllForUser(userId: string): Promise<DataSource[]> {
		return this.repository.getAllForUser(userId);
	}

	async getById(id: string, userId: string): Promise<DataSource | null> {
		const dataSource = await this.repository.getById(id);

		if (!dataSource || dataSource.userId !== userId) {
			return null;
		}

		return dataSource;
	}

	async getDefaultForUser(userId: string): Promise<DataSource | null> {
		return this.repository.getDefaultForUser(userId);
	}

	async create(data: {
		userId: string;
		name: string;
		connectionString: string;
		isDefault?: boolean;
	}): Promise<DataSource | null> {
		return this.repository.create(data);
	}

	async update(
		id: string,
		userId: string,
		data: {
			name?: string;
			connectionString?: string;
			isDefault?: boolean;
		}
	): Promise<DataSource | null> {
		const existing = await this.getById(id, userId);
		if (!existing) {
			return null;
		}

		return this.repository.update(id, data);
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const existing = await this.getById(id, userId);
		if (!existing) {
			return false;
		}

		return this.repository.delete(id);
	}
}

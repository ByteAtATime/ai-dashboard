import { injectable } from '@needle-di/core';
import { db } from '../db';
import { dataSources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { IDataSourceRepository } from '../interfaces/repository.interface';
import type { DataSource } from '../types/datasource.types';

@injectable()
export class DataSourceRepository implements IDataSourceRepository {
	async getAllForUser(userId: string): Promise<DataSource[]> {
		return db.query.dataSources.findMany({
			where: eq(dataSources.userId, userId)
		});
	}

	async getById(id: string): Promise<DataSource | null> {
		const results = await db.query.dataSources.findMany({
			where: eq(dataSources.id, id)
		});
		return results[0] || null;
	}

	async getDefaultForUser(userId: string): Promise<DataSource | null> {
		const results = await db.query.dataSources.findMany({
			where: (dataSources) => {
				return eq(dataSources.userId, userId) && eq(dataSources.isDefault, true);
			}
		});
		return results[0] || null;
	}

	async create(data: {
		userId: string;
		name: string;
		connectionString: string;
		isDefault?: boolean;
	}): Promise<DataSource | null> {
		const id = randomUUID();

		if (data.isDefault) {
			await db
				.update(dataSources)
				.set({ isDefault: false })
				.where(eq(dataSources.userId, data.userId) && eq(dataSources.isDefault, true));
		}

		await db.insert(dataSources).values({
			id,
			userId: data.userId,
			name: data.name,
			connectionString: data.connectionString,
			isDefault: data.isDefault ?? false,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		return this.getById(id);
	}

	async update(
		id: string,
		data: {
			name?: string;
			connectionString?: string;
			isDefault?: boolean;
		}
	): Promise<DataSource | null> {
		const dataSource = await this.getById(id);
		if (!dataSource) return null;

		if (data.isDefault) {
			await db
				.update(dataSources)
				.set({ isDefault: false })
				.where(eq(dataSources.userId, dataSource.userId) && eq(dataSources.isDefault, true));
		}

		await db
			.update(dataSources)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(dataSources.id, id));

		return this.getById(id);
	}

	async delete(id: string): Promise<boolean> {
		const dataSource = await this.getById(id);
		if (!dataSource) return false;

		await db.delete(dataSources).where(eq(dataSources.id, id));

		return true;
	}
}

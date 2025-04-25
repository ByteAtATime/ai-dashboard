import { injectable } from '@needle-di/core';
import { db } from '../db';
import { dataSources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { IDataSourceRepository } from '../interfaces/repository.interface';
import type { DataSource } from '../types/datasource.types';

@injectable()
export class DataSourceRepository implements IDataSourceRepository {
	async getAllForOrganization(organizationId: string): Promise<DataSource[]> {
		return db.query.dataSources.findMany({
			where: eq(dataSources.organizationId, organizationId)
		});
	}

	async getById(id: string): Promise<DataSource | null> {
		const results = await db.query.dataSources.findMany({
			where: eq(dataSources.id, id)
		});
		return results[0] || null;
	}

	async create(data: {
		userId: string;
		organizationId: string;
		name: string;
		connectionString: string;
	}): Promise<DataSource | null> {
		const id = randomUUID();

		await db.insert(dataSources).values({
			id,
			userId: data.userId,
			organizationId: data.organizationId,
			name: data.name,
			connectionString: data.connectionString,
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
		}
	): Promise<DataSource | null> {
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
		const result = await db
			.delete(dataSources)
			.where(eq(dataSources.id, id))
			.returning({ id: dataSources.id });
		return result.length > 0;
	}
}

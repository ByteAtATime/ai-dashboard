import { injectable } from '@needle-di/core';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import type {
	IDataSourceRepository,
	DataSource
} from '../interfaces/repositories/datasource.repository.interface';
import { db } from '../db';

@injectable()
export class PostgresDataSourceRepository implements IDataSourceRepository {
	async findById(id: string): Promise<DataSource | null> {
		const result = await db
			.select()
			.from(schema.dataSources)
			.where(eq(schema.dataSources.id, id))
			.limit(1);
		return result[0] ?? null;
	}

	async findByUserId(userId: string): Promise<DataSource[]> {
		return db.select().from(schema.dataSources).where(eq(schema.dataSources.userId, userId));
	}
}

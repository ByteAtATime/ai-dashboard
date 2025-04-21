import type { InferSelectModel } from 'drizzle-orm';
import type { dataSources } from '$lib/server/db/schema';

export type DataSource = InferSelectModel<typeof dataSources>;

export interface IDataSourceRepository {
	findById(id: string): Promise<DataSource | null>;
	findByUserId(userId: string): Promise<DataSource[]>;
}

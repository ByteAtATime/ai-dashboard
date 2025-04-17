import type { DatabaseSchema } from '../types/db.types';

export interface IRepository {
	executeReadOnlyQuery(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
	sampleTable(tableName: string, numRows: number): Promise<Record<string, unknown>[]>;
	getFullSchema(): Promise<DatabaseSchema>;
}

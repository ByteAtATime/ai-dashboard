import type { DisplayConfig } from '../types/display.types';

export type SqlGenerationResult = {
	display: DisplayConfig[];
	explanation?: string;
};

export type ProgressCallback = (message: string) => Promise<void>;

export interface ISqlGenerationService {
	generateSql(
		query: string,
		connectionString: string,
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult>;
}

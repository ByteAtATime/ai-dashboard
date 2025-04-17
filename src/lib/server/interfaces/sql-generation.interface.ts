import type { DisplayConfig, QueryContext } from '../types/display.types';

export type SqlGenerationResult = {
	display: DisplayConfig[];
	explanation?: string;
};

export type ProgressCallback = (message: string) => Promise<void>;

export interface ISqlGenerationService {
	generateSql(query: string, progressCallback?: ProgressCallback): Promise<SqlGenerationResult>;
	generateFollowupSql(
		followupInstruction: string,
		previousContext: QueryContext,
		progressCallback?: ProgressCallback
	): Promise<SqlGenerationResult>;
}

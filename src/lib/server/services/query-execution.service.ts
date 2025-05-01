import { inject, injectable } from '@needle-di/core';
import type { DashboardItemExecution } from '$lib/server/types/dashboard.types';
import type { IQueryExecutionService } from '../interfaces/services/query-execution.service.interface';
import type { IRepository } from '../interfaces/repository.interface';
import type { IDashboardItemExecutionRepository } from '../interfaces/repositories/dashboard-item-execution.repository.interface';
import { PostgresRepository } from '../repositories/postgres.repository';
import { PostgresDashboardItemExecutionRepository } from '../repositories/postgres.dashboard-item-execution.repository';

@injectable()
export class QueryExecutionService implements IQueryExecutionService {
	constructor(
		private repository: IRepository = inject(PostgresRepository),
		private executionRepo: IDashboardItemExecutionRepository = inject(
			PostgresDashboardItemExecutionRepository
		)
	) {}

	async executeQuery(
		sql: string,
		connectionString: string,
		dashboardItemId?: string
	): Promise<DashboardItemExecution> {
		let execution: DashboardItemExecution | null = null;

		if (dashboardItemId) {
			execution = await this.executionRepo.create({
				dashboardItemId,
				status: 'pending',
				executedAt: new Date(),
				results: null,
				errorMessage: null
			});
		}

		try {
			const results = await this.repository.executeReadOnlyQuery(sql, connectionString);

			if (dashboardItemId && execution) {
				const updatedExecution = await this.executionRepo.update(execution.id, {
					status: 'success',
					results
				});

				if (!updatedExecution) {
					throw new Error('Failed to update execution status after query.');
				}

				return updatedExecution;
			}

			return {
				id: 'temp-execution',
				dashboardItemId: dashboardItemId || 'temp-item',
				status: 'success',
				executedAt: new Date(),
				results,
				errorMessage: null
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

			if (dashboardItemId && execution) {
				const updatedExecution = await this.executionRepo.update(execution.id, {
					status: 'failed',
					errorMessage
				});

				if (!updatedExecution) {
					throw new Error('Failed to update execution status after query error.');
				}

				return updatedExecution;
			}

			return {
				id: 'temp-execution',
				dashboardItemId: dashboardItemId || 'temp-item',
				status: 'failed',
				executedAt: new Date(),
				results: null,
				errorMessage
			};
		}
	}
}

import { inject, injectable } from '@needle-di/core';
import pg from 'pg';
import type {
	FullDashboard,
	Dashboard,
	DashboardItem,
	DashboardItemExecution,
	DashboardItemWithLatestExecution,
	InsertDashboardItem,
	UpdateDashboard,
	UpdateDashboardItem,
	InsertFullDashboard
} from '$lib/server/types/dashboard.types';
import type { IDashboardService } from '../interfaces/services/dashboard.service.interface';
import type { IDataSourceService } from '../interfaces/services/datasource.service.interface';
import type { IDashboardRepository } from '../interfaces/repositories/dashboard.repository.interface';
import type { IDashboardItemRepository } from '../interfaces/repositories/dashboard-item.repository.interface';
import type { IDashboardItemExecutionRepository } from '../interfaces/repositories/dashboard-item-execution.repository.interface';
import { PostgresDashboardRepository } from '../repositories/postgres.dashboard.repository';
import { PostgresDashboardItemRepository } from '../repositories/postgres.dashboard-item.repository';
import { PostgresDashboardItemExecutionRepository } from '../repositories/postgres.dashboard-item-execution.repository';
import { DataSourceService } from './datasource.service';

class NotFoundError extends Error {
	constructor(message = 'Resource not found') {
		super(message);
		this.name = 'NotFoundError';
	}
}
class ForbiddenError extends Error {
	constructor(message = 'Forbidden') {
		super(message);
		this.name = 'ForbiddenError';
	}
}

@injectable()
export class DashboardService implements IDashboardService {
	private queryPools: Map<string, pg.Pool> = new Map();

	constructor(
		private dashboardRepo: IDashboardRepository = inject(PostgresDashboardRepository),
		private itemRepo: IDashboardItemRepository = inject(PostgresDashboardItemRepository),
		private executionRepo: IDashboardItemExecutionRepository = inject(
			PostgresDashboardItemExecutionRepository
		),
		private dataSourceService: IDataSourceService = inject(DataSourceService)
	) {}

	private getQueryPool(connectionString: string): pg.Pool {
		if (this.queryPools.has(connectionString)) {
			return this.queryPools.get(connectionString)!;
		}
		const newPool = new pg.Pool({
			connectionString,

			ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
			query_timeout: 10000
		});
		this.queryPools.set(connectionString, newPool);
		return newPool;
	}

	async getDashboardsForUser(userId: string): Promise<Dashboard[]> {
		return this.dashboardRepo.findByUserId(userId);
	}

	async getDashboardById(dashboardId: string, userId: string): Promise<FullDashboard | null> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);

		if (!dashboard) {
			return null;
		}
		if (dashboard.userId !== userId) {
			throw new ForbiddenError('User does not have access to this dashboard');
		}

		const items = await this.itemRepo.findByDashboardId(dashboardId);

		const itemsWithLatestExecution: DashboardItemWithLatestExecution[] = await Promise.all(
			items.map(async (item) => {
				const latestExecution = await this.executionRepo.findLatestSuccessfulByItemId(item.id);
				return {
					...item,
					latestExecution: latestExecution ?? null
				};
			})
		);

		return {
			...dashboard,
			items: itemsWithLatestExecution
		};
	}

	async createDashboard(data: InsertFullDashboard): Promise<FullDashboard> {
		await this.dataSourceService.getDataSourceById(data.dataSourceId, data.userId);

		const newDashboard = await this.dashboardRepo.create(data);

		const createdItems = data.items
			? await Promise.all(
					data.items.map((itemData) =>
						this.itemRepo.create({
							...itemData,
							layout: itemData.layout ?? {},
							explanation: itemData.explanation ?? null,
							dashboardId: newDashboard.id
						})
					)
				)
			: [];

		return {
			...newDashboard,
			items: createdItems.map((item) => ({ ...item, latestExecution: null }))
		};
	}

	async updateDashboard(
		dashboardId: string,
		userId: string,
		data: UpdateDashboard
	): Promise<Dashboard | null> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard) {
			throw new NotFoundError('Dashboard not found');
		}
		if (dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot update this dashboard');
		}

		const updateData: Partial<Pick<Dashboard, 'name' | 'visibility'>> = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.visibility !== undefined) updateData.visibility = data.visibility;

		if (Object.keys(updateData).length === 0) {
			return dashboard;
		}

		return this.dashboardRepo.update(dashboardId, updateData);
	}

	async deleteDashboard(dashboardId: string, userId: string): Promise<boolean> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard) {
			return false;
		}
		if (dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot delete this dashboard');
		}
		return this.dashboardRepo.delete(dashboardId);
	}

	async addDashboardItem(
		dashboardId: string,
		userId: string,
		itemData: InsertDashboardItem
	): Promise<DashboardItem> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard) {
			throw new NotFoundError('Dashboard not found');
		}
		if (dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot add items to this dashboard');
		}

		return this.itemRepo.create({
			...itemData,
			explanation: itemData.explanation ?? null,
			dashboardId: dashboardId
		});
	}

	async updateDashboardItem(
		itemId: string,
		userId: string,
		itemData: UpdateDashboardItem
	): Promise<DashboardItem | null> {
		const item = await this.itemRepo.findById(itemId);
		if (!item) {
			throw new NotFoundError('Dashboard item not found');
		}
		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard || dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot update this dashboard item');
		}
		return this.itemRepo.update(itemId, itemData);
	}

	async deleteDashboardItem(itemId: string, userId: string): Promise<boolean> {
		const item = await this.itemRepo.findById(itemId);
		if (!item) {
			return false;
		}
		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard || dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot delete this dashboard item');
		}
		return this.itemRepo.delete(itemId);
	}

	async refreshDashboardItem(itemId: string, userId: string): Promise<DashboardItemExecution> {
		const itemResult = await this.itemRepo.findById(itemId);
		if (!itemResult) {
			throw new NotFoundError('Dashboard item not found');
		}

		const item = itemResult as DashboardItem;

		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard) {
			throw new NotFoundError('Parent dashboard not found for item');
		}
		if (dashboard.userId !== userId) {
			throw new ForbiddenError('User cannot refresh this dashboard item');
		}

		const dataSource = await this.dataSourceService.getDataSourceById(
			dashboard.dataSourceId,
			userId
		);
		if (!dataSource) {
			throw new NotFoundError(
				`Datasource with ID ${dashboard.dataSourceId} not found or not accessible by user.`
			);
		}
		const connectionString = dataSource.connectionString;

		const initialExecution = await this.executionRepo.create({
			dashboardItemId: itemId,
			status: 'pending',
			executedAt: new Date(),
			results: null,
			errorMessage: null
		});
		let finalExecution: DashboardItemExecution | null = initialExecution;

		let client: pg.PoolClient | null = null;
		try {
			const pool = this.getQueryPool(connectionString);
			client = await pool.connect();

			await client.query('BEGIN TRANSACTION READ ONLY');
			await client.query('SET statement_timeout = 10000');

			const result = await client.query(item.sql);

			await client.query('COMMIT');

			const updatedSuccessExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'success',
				results: { data: result.rows }
			});
			if (!updatedSuccessExecution) {
				console.error(`Failed to update execution ${initialExecution.id} to success status.`);
				finalExecution = initialExecution;
			} else {
				finalExecution = updatedSuccessExecution;
			}
		} catch (error: unknown) {
			if (client) {
				await client.query('ROLLBACK');
			}
			console.error(`Error executing query for item ${itemId}:`, error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
			const updatedErrorExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'failed',
				errorMessage: errorMessage
			});
			if (!updatedErrorExecution) {
				console.error(`Failed to update execution ${initialExecution.id} to error status.`);
				finalExecution = initialExecution;
			} else {
				finalExecution = updatedErrorExecution;
			}
		} finally {
			if (client) {
				client.release();
			}
		}

		if (!finalExecution) {
			throw new Error(`Execution record ${initialExecution.id} could not be retrieved.`);
		}

		return finalExecution;
	}
}

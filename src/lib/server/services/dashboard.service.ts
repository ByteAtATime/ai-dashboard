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
import { NotFoundError, ForbiddenError } from '../errors';

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

	async getDashboardsForOrganization(organizationId: string): Promise<Dashboard[]> {
		return this.dashboardRepo.findByOrganizationId(organizationId);
	}

	async getDashboardById(
		dashboardId: string,
		organizationId: string
	): Promise<FullDashboard | null> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);

		if (!dashboard || dashboard.organizationId !== organizationId) {
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

	async createDashboard(
		data: InsertFullDashboard & { organizationId: string }
	): Promise<FullDashboard> {
		const dataSource = await this.dataSourceService.getDataSourceById(
			data.dataSourceId,
			data.organizationId
		);
		if (!dataSource) {
			throw new NotFoundError('Datasource not found or not accessible by user.');
		}

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

		// Automatically execute all items with their SQL query
		const itemsWithLatestExecution = await Promise.all(
			createdItems.map(async (item) => {
				if (item.sql) {
					try {
						const execution = await this.executeItemQuery(item.id, dataSource.connectionString);
						return { ...item, latestExecution: execution };
					} catch (error) {
						console.error(`Error auto-executing item ${item.id}:`, error);
						return { ...item, latestExecution: null };
					}
				}
				return { ...item, latestExecution: null };
			})
		);

		return {
			...newDashboard,
			items: itemsWithLatestExecution
		};
	}

	// Add a helper method to execute the query for a dashboard item
	private async executeItemQuery(
		itemId: string,
		connectionString: string
	): Promise<DashboardItemExecution | null> {
		const item = await this.itemRepo.findById(itemId);
		if (!item || !item.sql) {
			return null;
		}

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

			finalExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'success',
				results: result.rows
			});
		} catch (error: unknown) {
			if (client) {
				await client.query('ROLLBACK');
			}
			const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
			finalExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'failed',
				errorMessage: errorMessage
			});
		} finally {
			client?.release();
		}

		return finalExecution;
	}

	async updateDashboard(
		dashboardId: string,
		organizationId: string,
		data: UpdateDashboard
	): Promise<Dashboard | null> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
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

	async deleteDashboard(dashboardId: string, organizationId: string): Promise<boolean> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
			throw new ForbiddenError('User cannot delete this dashboard');
		}
		return this.dashboardRepo.delete(dashboardId);
	}

	async addDashboardItem(
		dashboardId: string,
		organizationId: string,
		itemData: InsertDashboardItem
	): Promise<DashboardItem> {
		const dashboard = await this.dashboardRepo.findById(dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
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
		organizationId: string,
		itemData: UpdateDashboardItem
	): Promise<DashboardItem | null> {
		const item = await this.itemRepo.findById(itemId);
		if (!item) {
			throw new NotFoundError('Dashboard item not found');
		}
		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
			throw new ForbiddenError('User cannot update this dashboard item');
		}
		return this.itemRepo.update(itemId, itemData);
	}

	async deleteDashboardItem(itemId: string, organizationId: string): Promise<boolean> {
		const item = await this.itemRepo.findById(itemId);
		if (!item) {
			return false;
		}
		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
			throw new ForbiddenError('User cannot delete this dashboard item');
		}
		return this.itemRepo.delete(itemId);
	}

	async refreshDashboardItem(
		itemId: string,
		organizationId: string
	): Promise<DashboardItemExecution> {
		const itemResult = await this.itemRepo.findById(itemId);
		if (!itemResult) {
			throw new NotFoundError('Dashboard item not found');
		}

		const item = itemResult as DashboardItem;

		const dashboard = await this.dashboardRepo.findById(item.dashboardId);
		if (!dashboard || dashboard.organizationId !== organizationId) {
			throw new ForbiddenError('User cannot refresh this dashboard item (dashboard access)');
		}

		const dataSource = await this.dataSourceService.getDataSourceById(
			dashboard.dataSourceId,
			organizationId
		);
		if (!dataSource) {
			throw new NotFoundError('Datasource not found or not accessible by user.');
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

			finalExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'success',
				results: result.rows
			});
		} catch (error: unknown) {
			if (client) {
				await client.query('ROLLBACK');
			}
			const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
			finalExecution = await this.executionRepo.update(initialExecution.id, {
				status: 'failed',
				errorMessage: errorMessage
			});
		} finally {
			client?.release();
		}

		if (!finalExecution) {
			throw new Error('Failed to update execution status after query.');
		}

		return finalExecution;
	}
}

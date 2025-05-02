import { describe, it, expect, beforeEach } from 'vitest';
import { DataSourceService } from './datasource.service';
import { ForbiddenError } from '../errors';
import type { DataSource } from '../types/datasource.types';
import { MockDataSourceRepository } from '../repositories/datasource.mock';

describe('DataSourceService', () => {
	let dataSourceRepo: MockDataSourceRepository;
	let service: DataSourceService;
	const organizationId = 'org1';
	const otherOrganizationId = 'org2';
	const userId = 'user1';
	const dataSourceId = 'ds1';

	const mockDataSource: DataSource = {
		id: dataSourceId,
		name: 'Test DS',
		organizationId: organizationId,
		connectionString: 'mock_connection_string',
		createdAt: new Date(),
		updatedAt: new Date(),
		userId
	};

	const mockOtherOrgDataSource: DataSource = {
		...mockDataSource,
		id: 'ds2',
		organizationId: otherOrganizationId
	};

	beforeEach(() => {
		dataSourceRepo = new MockDataSourceRepository();
		service = new DataSourceService(dataSourceRepo);
	});

	describe('getAllForOrganization', () => {
		it('should get all data sources for a specific organization', async () => {
			const expectedDataSources = [
				{ ...mockDataSource, id: '1', name: 'DataSource 1' },
				{ ...mockDataSource, id: '2', name: 'DataSource 2' }
			];
			dataSourceRepo.getAllForOrganization.mockResolvedValue(expectedDataSources);

			const dataSources = await service.getAllForOrganization(organizationId);

			expect(dataSources).toHaveLength(2);
			expect(dataSources[0].name).toBe('DataSource 1');
			expect(dataSources[1].organizationId).toBe(organizationId);
			expect(dataSourceRepo.getAllForOrganization).toHaveBeenCalledWith(organizationId);
		});

		it('should return an empty array if no data sources found for the organization', async () => {
			dataSourceRepo.getAllForOrganization.mockResolvedValue([]);

			const dataSources = await service.getAllForOrganization(organizationId);

			expect(dataSources).toEqual([]);
			expect(dataSourceRepo.getAllForOrganization).toHaveBeenCalledWith(organizationId);
		});
	});

	describe('getById', () => {
		it('should return a data source if found and belongs to the organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);

			const result = await service.getById(dataSourceId, organizationId);

			expect(result).toEqual(mockDataSource);
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
		});

		it('should return null if the data source is not found', async () => {
			dataSourceRepo.getById.mockResolvedValue(null);

			const result = await service.getById('nonexistent-id', organizationId);

			expect(result).toBeNull();
			expect(dataSourceRepo.getById).toHaveBeenCalledWith('nonexistent-id');
		});

		it('should return null if the data source belongs to a different organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockOtherOrgDataSource);

			const result = await service.getById(mockOtherOrgDataSource.id, organizationId);

			expect(result).toBeNull();
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(mockOtherOrgDataSource.id);
		});
	});

	describe('getDataSourceById', () => {
		it('should return a data source if found and belongs to the organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);

			const result = await service.getDataSourceById(dataSourceId, organizationId);

			expect(result).toEqual(mockDataSource);
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
		});

		it('should throw ForbiddenError if the data source is not found', async () => {
			dataSourceRepo.getById.mockResolvedValue(null);

			await expect(service.getDataSourceById('nonexistent-id', organizationId)).rejects.toThrow(
				ForbiddenError
			);
			await expect(service.getDataSourceById('nonexistent-id', organizationId)).rejects.toThrow(
				'User does not have access to this data source'
			);

			expect(dataSourceRepo.getById).toHaveBeenCalledWith('nonexistent-id');
		});

		it('should throw ForbiddenError if the data source belongs to a different organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockOtherOrgDataSource);

			await expect(
				service.getDataSourceById(mockOtherOrgDataSource.id, organizationId)
			).rejects.toThrow(ForbiddenError);
			await expect(
				service.getDataSourceById(mockOtherOrgDataSource.id, organizationId)
			).rejects.toThrow('User does not have access to this data source');

			expect(dataSourceRepo.getById).toHaveBeenCalledWith(mockOtherOrgDataSource.id);
		});
	});

	describe('create', () => {
		it('should create a new data source', async () => {
			const createData = {
				userId: userId,
				organizationId: organizationId,
				name: 'New DS',
				connectionString: 'new-conn-string'
			};
			const expectedDataSource = {
				id: 'new-ds-id',
				...createData
			};
			dataSourceRepo.create.mockResolvedValue(expectedDataSource);

			const result = await service.create(createData);

			expect(result).toEqual(expectedDataSource);
			expect(dataSourceRepo.create).toHaveBeenCalledWith(createData);
		});

		it('should return null if repository fails to create', async () => {
			const createData = {
				userId: userId,
				organizationId: organizationId,
				name: 'New DS',
				connectionString: 'new-conn-string'
			};
			dataSourceRepo.create.mockResolvedValue(null);

			const result = await service.create(createData);

			expect(result).toBeNull();
			expect(dataSourceRepo.create).toHaveBeenCalledWith(createData);
		});
	});

	describe('update', () => {
		const updateData = {
			name: 'Updated DS Name',
			connectionString: 'updated-conn-string'
		};

		it('should update the data source if found and belongs to the organization', async () => {
			const updatedDataSource = { ...mockDataSource, ...updateData };
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);
			dataSourceRepo.update.mockResolvedValue(updatedDataSource);

			const result = await service.update(dataSourceId, organizationId, updateData);

			expect(result).toEqual(updatedDataSource);
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.update).toHaveBeenCalledWith(dataSourceId, updateData);
		});

		it('should throw ForbiddenError if the data source to update is not found', async () => {
			dataSourceRepo.getById.mockResolvedValue(null);

			await expect(service.update(dataSourceId, organizationId, updateData)).rejects.toThrow(
				ForbiddenError
			);
			await expect(service.update(dataSourceId, organizationId, updateData)).rejects.toThrow(
				'Data source not found or access denied.'
			);

			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.update).not.toHaveBeenCalled();
		});

		it('should throw ForbiddenError if the data source to update belongs to another organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockOtherOrgDataSource);

			await expect(
				service.update(mockOtherOrgDataSource.id, organizationId, updateData)
			).rejects.toThrow(ForbiddenError);
			await expect(
				service.update(mockOtherOrgDataSource.id, organizationId, updateData)
			).rejects.toThrow('Data source not found or access denied.');

			expect(dataSourceRepo.getById).toHaveBeenCalledWith(mockOtherOrgDataSource.id);
			expect(dataSourceRepo.update).not.toHaveBeenCalled();
		});

		it('should return null if update operation fails in the repository', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);
			dataSourceRepo.update.mockResolvedValue(null);

			const result = await service.update(dataSourceId, organizationId, updateData);

			expect(result).toBeNull();
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.update).toHaveBeenCalledWith(dataSourceId, updateData);
		});
	});

	describe('delete', () => {
		it('should delete the data source if found and belongs to the organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);
			dataSourceRepo.delete.mockResolvedValue(true);

			const result = await service.delete(dataSourceId, organizationId);

			expect(result).toBe(true);
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.delete).toHaveBeenCalledWith(dataSourceId);
		});

		it('should return false if delete operation fails in the repository', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockDataSource);
			dataSourceRepo.delete.mockResolvedValue(false);

			const result = await service.delete(dataSourceId, organizationId);

			expect(result).toBe(false);
			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.delete).toHaveBeenCalledWith(dataSourceId);
		});

		it('should throw ForbiddenError if the data source to delete is not found', async () => {
			dataSourceRepo.getById.mockResolvedValue(null);

			await expect(service.delete(dataSourceId, organizationId)).rejects.toThrow(ForbiddenError);
			await expect(service.delete(dataSourceId, organizationId)).rejects.toThrow(
				'Data source not found or access denied.'
			);

			expect(dataSourceRepo.getById).toHaveBeenCalledWith(dataSourceId);
			expect(dataSourceRepo.delete).not.toHaveBeenCalled();
		});

		it('should throw ForbiddenError if the data source to delete belongs to another organization', async () => {
			dataSourceRepo.getById.mockResolvedValue(mockOtherOrgDataSource);

			await expect(service.delete(mockOtherOrgDataSource.id, organizationId)).rejects.toThrow(
				ForbiddenError
			);
			await expect(service.delete(mockOtherOrgDataSource.id, organizationId)).rejects.toThrow(
				'Data source not found or access denied.'
			);

			expect(dataSourceRepo.getById).toHaveBeenCalledWith(mockOtherOrgDataSource.id);
			expect(dataSourceRepo.delete).not.toHaveBeenCalled();
		});
	});
});

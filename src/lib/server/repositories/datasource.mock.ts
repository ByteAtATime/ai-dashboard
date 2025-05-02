import { vi } from 'vitest';
import type { IDataSourceRepository } from '../interfaces/repository.interface';

export class MockDataSourceRepository implements IDataSourceRepository {
	getAllForOrganization = vi.fn();
	getById = vi.fn();
	create = vi.fn();
	update = vi.fn();
	delete = vi.fn();
}

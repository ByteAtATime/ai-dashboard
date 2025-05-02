import { vi } from 'vitest';
import type { IRepository } from '../interfaces/repository.interface';

export class MockRepository implements IRepository {
	executeReadOnlyQuery = vi.fn();
	sampleTable = vi.fn();
	getFullSchema = vi.fn();
}

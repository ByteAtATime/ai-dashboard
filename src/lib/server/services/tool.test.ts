import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolService } from './tool.service';
import type { AIToolCall, AIToolDefinition } from '../types/openrouter.types';
import { MockRepository } from '../repositories/postgres.mock';

describe('ToolService', () => {
	let mockPostgresRepository: MockRepository;
	let service: ToolService;
	const connectionString = 'test-connection-string';

	const sampleTableToolCall: AIToolCall = {
		id: 'call_123',
		type: 'function',
		function: {
			name: 'sampleTable',
			arguments: JSON.stringify({ tableName: 'users', numRows: 5 })
		}
	};

	const sampleTableResult = [
		{ id: 1, name: 'Alice' },
		{ id: 2, name: 'Bob' }
	];

	const invalidArgsToolCall: AIToolCall = {
		id: 'call_456',
		type: 'function',
		function: {
			name: 'sampleTable',
			arguments: '{invalid json'
		}
	};

	const unknownFunctionToolCall: AIToolCall = {
		id: 'call_789',
		type: 'function',
		function: {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			name: 'unknownFunction' as any,
			arguments: JSON.stringify({ param: 'value' })
		}
	};

	beforeEach(() => {
		mockPostgresRepository = new MockRepository();
		service = new ToolService(mockPostgresRepository);
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getToolDefinitions', () => {
		it('should return the correct array of tool definitions', () => {
			const definitions = service.getToolDefinitions();

			expect(definitions).toBeInstanceOf(Array);
			expect(definitions).toHaveLength(1);

			const expectedDefinition: AIToolDefinition = {
				type: 'function',
				function: {
					name: 'sampleTable',
					description:
						'Get sample rows from a specific table to understand its data structure - MUST be called before generating SQL for tables not previously sampled',
					parameters: {
						type: 'object',
						properties: {
							tableName: {
								type: 'string',
								description: 'The name of the table to sample from'
							},
							numRows: {
								type: 'integer',
								description: 'Number of rows to return (between 1 and 10)'
							}
						},
						required: ['tableName', 'numRows']
					}
				}
			};

			expect(definitions[0]).toEqual(expectedDefinition);
		});
	});

	describe('handleToolCall', () => {
		it("should handle 'sampleTable' tool call successfully without progress callback", async () => {
			mockPostgresRepository.sampleTable.mockResolvedValue(sampleTableResult);
			const args = JSON.parse(sampleTableToolCall.function.arguments);

			const result = await service.handleToolCall(sampleTableToolCall, connectionString);

			expect(mockPostgresRepository.sampleTable).toHaveBeenCalledWith(
				args.tableName,
				args.numRows,
				connectionString
			);
			expect(result).toEqual({
				tool_call_id: sampleTableToolCall.id,
				name: sampleTableToolCall.function.name,
				content: JSON.stringify(sampleTableResult)
			});
		});

		it("should handle 'sampleTable' tool call successfully with progress callback", async () => {
			mockPostgresRepository.sampleTable.mockResolvedValue(sampleTableResult);
			const mockProgressCallback = vi.fn().mockResolvedValue(undefined);
			const args = JSON.parse(sampleTableToolCall.function.arguments);

			const result = await service.handleToolCall(
				sampleTableToolCall,
				connectionString,
				mockProgressCallback
			);

			expect(mockProgressCallback).toHaveBeenCalledWith(
				`Sampling ${args.numRows} rows from \`${args.tableName}\` table`
			);
			expect(mockProgressCallback).toHaveBeenCalledBefore(mockPostgresRepository.sampleTable);

			expect(mockPostgresRepository.sampleTable).toHaveBeenCalledWith(
				args.tableName,
				args.numRows,
				connectionString
			);

			expect(result).toEqual({
				tool_call_id: sampleTableToolCall.id,
				name: sampleTableToolCall.function.name,
				content: JSON.stringify(sampleTableResult)
			});
		});

		it('should throw an error if argument parsing fails', async () => {
			const mockProgressCallback = vi.fn();

			await expect(
				service.handleToolCall(invalidArgsToolCall, connectionString, mockProgressCallback)
			).rejects.toThrow(`Unable to parse arguments for ${invalidArgsToolCall.function.name}`);

			expect(mockPostgresRepository.sampleTable).not.toHaveBeenCalled();
			expect(mockProgressCallback).not.toHaveBeenCalled();
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to parse tool call arguments:')
			);
			expect(console.error).toHaveBeenCalledWith(
				`Arguments: ${invalidArgsToolCall.function.arguments}`
			);
		});

		it('should throw an error for an unknown function name', async () => {
			const mockProgressCallback = vi.fn();

			await expect(
				service.handleToolCall(unknownFunctionToolCall, connectionString, mockProgressCallback)
			).rejects.toThrow(`Unknown function: ${unknownFunctionToolCall.function.name}`);

			expect(mockPostgresRepository.sampleTable).not.toHaveBeenCalled();
			expect(mockProgressCallback).not.toHaveBeenCalled();

			expect(console.error).toHaveBeenCalledWith(
				`Unknown function called: ${unknownFunctionToolCall.function.name}`
			);
		});

		it('should propagate errors from the repository', async () => {
			const dbError = new Error('Database connection failed');
			mockPostgresRepository.sampleTable.mockRejectedValue(dbError);
			const args = JSON.parse(sampleTableToolCall.function.arguments);

			await expect(service.handleToolCall(sampleTableToolCall, connectionString)).rejects.toThrow(
				dbError
			);

			expect(mockPostgresRepository.sampleTable).toHaveBeenCalledWith(
				args.tableName,
				args.numRows,
				connectionString
			);
		});

		it('should handle repository returning non-JSON serializable content (e.g., undefined) gracefully', async () => {
			mockPostgresRepository.sampleTable.mockResolvedValue(undefined);
			const args = JSON.parse(sampleTableToolCall.function.arguments);

			const result = await service.handleToolCall(sampleTableToolCall, connectionString);

			expect(mockPostgresRepository.sampleTable).toHaveBeenCalledWith(
				args.tableName,
				args.numRows,
				connectionString
			);

			expect(result).toEqual({
				tool_call_id: sampleTableToolCall.id,
				name: sampleTableToolCall.function.name,
				content: undefined
			});
		});

		it('should handle repository returning null', async () => {
			mockPostgresRepository.sampleTable.mockResolvedValue(null);
			const args = JSON.parse(sampleTableToolCall.function.arguments);

			const result = await service.handleToolCall(sampleTableToolCall, connectionString);

			expect(mockPostgresRepository.sampleTable).toHaveBeenCalledWith(
				args.tableName,
				args.numRows,
				connectionString
			);
			expect(result).toEqual({
				tool_call_id: sampleTableToolCall.id,
				name: sampleTableToolCall.function.name,
				content: 'null'
			});
		});
	});
});

import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	let mockData = null;
	const mockQueryResultJson = env.MOCK_QUERY_RESULT;

	if (mockQueryResultJson) {
		try {
			mockData = JSON.parse(mockQueryResultJson);
			console.log('Loaded mock query result from environment variable.');
		} catch (error) {
			console.error('Failed to parse MOCK_QUERY_RESULT JSON:', error);
		}
	}

	return {
		mockData // This will be null if the env var is not set or invalid JSON
	};
};

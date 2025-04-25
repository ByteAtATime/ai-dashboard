import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import { Container } from '@needle-di/core';
import { DataSourceService } from '$lib/server/services/datasource.service';
import type { DataSource } from '$lib/server/types/datasource.types';

export const load: PageServerLoad = async ({ request }) => {
	let mockData = null;
	const mockQueryResultJson = env.MOCK_QUERY_RESULT;

	if (mockQueryResultJson) {
		try {
			mockData = JSON.parse(mockQueryResultJson);
			console.log('Loaded mock query result from environment variable.');
		} catch (err) {
			console.error('Failed to parse MOCK_QUERY_RESULT JSON:', err);
		}
	}

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		redirect(302, '/login');
	}

	const organizationId = session.session?.activeOrganizationId;
	if (!organizationId && !mockData) {
		error(500, 'No active organization found for the session.');
	}

	let dataSources: DataSource[] = [];
	if (organizationId) {
		try {
			const dataSourceService = new Container().get(DataSourceService);
			dataSources = await dataSourceService.getAllForOrganization(organizationId);
		} catch (err) {
			console.error('Error loading data sources in query/+page.server.ts:', err);
		}
	}

	return {
		mockData,
		dataSources
	};
};

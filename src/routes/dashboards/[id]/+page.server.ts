import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { DashboardService } from '$lib/server/services/dashboard.service';
import { Container } from '@needle-di/core';
import { ForbiddenError } from '$lib/server/errors';

export const load: PageServerLoad = async ({ params, request }) => {
	const { id } = params;

	if (!id) {
		error(404, 'Dashboard ID is required');
	}

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		redirect(302, '/login');
	}

	const organizationId = session.session?.activeOrganizationId;
	if (!organizationId) {
		error(500, 'No active organization found for the session.');
	}

	try {
		const dashboardService = new Container().get(DashboardService);
		const dashboard = await dashboardService.getDashboardById(id, organizationId);

		if (!dashboard) {
			error(404, 'Dashboard not found or not accessible.');
		}

		return {
			dashboard
		};
	} catch (err) {
		if (err instanceof ForbiddenError) {
			error(404, 'Dashboard not found or not accessible.');
		}
		console.error(`Error loading dashboard ${id} in +page.server.ts:`, err);
		error(500, 'Failed to load dashboard.');
	}
};

import { auth } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Dashboard } from '$lib/server/types/dashboard.types';
import { DashboardService } from '$lib/server/services/dashboard.service';
import { Container } from '@needle-di/core';

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session || !session.user) {
		redirect(302, '/login');
	}

	const organizationId = session.session?.activeOrganizationId;

	if (!organizationId) {
		error(500, 'No active organization found for the session.');
	}

	try {
		// Resolve service using a new container instance
		const dashboardService = new Container().get(DashboardService);

		const orgDashboards = await dashboardService.getDashboardsForOrganization(organizationId);

		return {
			dashboards: orgDashboards.map((d: Dashboard) => ({
				id: d.id,
				name: d.name,
				createdAt: d.createdAt
			}))
		};
	} catch (err) {
		console.error('Error loading dashboards in +page.server.ts:', err);
		error(500, 'Failed to load dashboards for the organization.');
	}
};

import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { dashboards } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	const { id } = params;

	if (!id) {
		throw error(404, 'Dashboard not found');
	}

	const session = await auth.api.getSession({ headers: request.headers });

	if (!session || !session.user) {
		throw redirect(302, '/login');
	}

	// Fetch the dashboard and ensure it belongs to the current user
	const [dashboard] = await db
		.select()
		.from(dashboards)
		.where(and(eq(dashboards.id, id), eq(dashboards.userId, session.user.id)));

	if (!dashboard) {
		throw error(404, 'Dashboard not found');
	}

	return {
		dashboard
	};
};

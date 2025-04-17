import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { dashboards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session || !session.user) {
		throw redirect(302, '/login');
	}

	const userDashboards = await db
		.select({
			id: dashboards.id,
			name: dashboards.name,
			createdAt: dashboards.createdAt
		})
		.from(dashboards)
		.where(eq(dashboards.userId, session.user.id))
		.orderBy(dashboards.createdAt);

	return {
		dashboards: userDashboards
	};
};

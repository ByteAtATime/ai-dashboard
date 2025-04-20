import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { id } = params;

	if (!id) {
		throw error(404, 'Dashboard not found');
	}

	const res = await fetch(`/api/dashboards/${id}`);

	if (!res.ok) {
		throw error(res.status, 'Failed to fetch dashboard');
	}

	const dashboard = await res.json();

	if (!dashboard || dashboard.error) {
		throw error(res.status, dashboard.error);
	}

	return {
		dashboard
	};
};

import { Container, injectable, inject } from '@needle-di/core';
import { Hono } from 'hono';
import { auth } from '../auth';
import { type IApi } from '../interfaces/api.interface';
import { DashboardRoutes } from './dashboard.routes';
import { QueryRoutes } from './query.routes';
import { DataSourceRoutes } from './datasource.routes';
import type { User } from 'better-auth';

export type AppEnv = {
	Variables: {
		user?: User & {
			activeOrganizationId?: string | null;
		};
	};
};

@injectable()
export class Api implements IApi {
	private app: Hono<AppEnv>;

	constructor(
		private dashboardRoutes = inject(DashboardRoutes),
		private queryRoutes = inject(QueryRoutes),
		private dataSourceRoutes = inject(DataSourceRoutes)
	) {
		this.app = new Hono<AppEnv>().basePath('/api');
		this.setupRoutes();
	}

	private setupRoutes() {
		this.app.use('*', async (c, next) => {
			const session = await auth.api.getSession({ headers: c.req.raw.headers });
			c.set(
				'user',
				session
					? { ...session.user, activeOrganizationId: session.session.activeOrganizationId }
					: undefined
			);

			await next();
		});

		this.app.get('/', (c) => c.text('API Running'));
		this.app.on(['POST', 'GET'], ['/auth/:rest{.*}'], (c) => auth.handler(c.req.raw));

		this.app.route('/dashboards', this.dashboardRoutes.routes());

		this.app.route('/query', this.queryRoutes.routes());

		this.app.route('/datasources', this.dataSourceRoutes.routes());
	}

	public routes() {
		return this.app;
	}
}

export const routes = new Container().get(Api).routes();

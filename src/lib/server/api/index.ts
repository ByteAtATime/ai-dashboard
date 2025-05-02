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
	}

	public routes() {
		return (
			this.app
				.use('*', async (c, next) => {
					const session = await auth.api.getSession({ headers: c.req.raw.headers });
					c.set(
						'user',
						session
							? { ...session.user, activeOrganizationId: session.session.activeOrganizationId }
							: undefined
					);

					await next();
				})
				.get('/', (c) => c.text('API Running'))
				// @ts-expect-error -- TODO: why does it not recognize the `handler` method
				.on(['POST', 'GET'], ['/auth/:rest{.*}'], (c) => auth.handler(c.req.raw))
				.route('/dashboards', this.dashboardRoutes.routes())
				.route('/query', this.queryRoutes.routes())
				.route('/datasources', this.dataSourceRoutes.routes())
		);
	}
}

export const routes = new Container().get(Api).routes();
export type ApiRoutes = ReturnType<Api['routes']>;

import { Container, injectable, inject } from '@needle-di/core';
import { Hono } from 'hono';
import { auth } from '../auth';
import { type IApi } from '../interfaces/api.interface';
import { DashboardRoutes } from './dashboard.routes';
import { QueryRoutes } from './query.routes';
import { PostgresRepository } from '../repositories/postgres.repository';
import { SqlGenerationService } from '../services/sql-generation.service';
import { OpenRouterService } from '../services/openrouter.service';
import { SchemaService } from '../services/schema.service';
import { ToolService } from '../services/tool.service';
import { PromptService } from '../services/prompt.service';

@injectable()
export class Api implements IApi {
	private app: Hono;

	constructor(
		private dashboardRoutes = inject(DashboardRoutes),
		private queryRoutes = inject(QueryRoutes)
	) {
		this.app = new Hono().basePath('/api');
		this.setupRoutes();
	}

	private setupRoutes() {
		this.app.get('/', (c) => c.text('API Running'));
		this.app.on(['POST', 'GET'], '/auth/**', (c) => auth.handler(c.req.raw));

		// Mount dashboard routes
		this.app.route('/dashboards', this.dashboardRoutes.routes());

		// Mount query routes
		this.app.route('/query', this.queryRoutes.routes());
	}

	public routes() {
		return this.app;
	}
}

// Setup the dependency injection container
const container = new Container();

// Register services
container.register('IRepository', { useClass: PostgresRepository });
container.register('ISqlGenerationService', { useClass: SqlGenerationService });

// Export the routes for use in the app
export const routes = container.get(Api).routes();

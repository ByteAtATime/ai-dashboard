import { pgTable, text, uuid, jsonb, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const dashboardVisibility = pgEnum('dashboard_visibility', ['private', 'public']);
export const executionStatus = pgEnum('execution_status', ['pending', 'success', 'failed']);

export const dataSources = pgTable('data_sources', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	name: text('name').notNull(),
	connectionString: text('connection_string').notNull(),
	isDefault: boolean('is_default').default(false),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const dashboards = pgTable('dashboards', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	dataSourceId: uuid('data_source_id')
		.references(() => dataSources.id, { onDelete: 'set null' })
		.notNull(),
	name: text('name').notNull(),
	query: text('query').notNull(),
	visibility: dashboardVisibility('visibility').default('private').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const dashboardItems = pgTable('dashboard_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	dashboardId: uuid('dashboard_id')
		.references(() => dashboards.id, { onDelete: 'cascade' })
		.notNull(),
	sql: text('sql').notNull(),
	explanation: text('explanation'),
	type: text('type').notNull(),
	layout: jsonb('layout').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const dashboardItemExecutions = pgTable('dashboard_item_executions', {
	id: uuid('id').primaryKey().defaultRandom(),
	dashboardItemId: uuid('dashboard_item_id')
		.references(() => dashboardItems.id, { onDelete: 'cascade' })
		.notNull(),
	executedAt: timestamp('executed_at').defaultNow().notNull(),
	status: executionStatus('status').notNull(),
	results: jsonb('results'),
	errorMessage: text('error_message')
});

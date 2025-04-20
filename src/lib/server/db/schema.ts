import { pgTable, text, uuid, jsonb, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const dashboardVisibility = pgEnum('dashboard_visibility', ['private', 'public']);

export const dashboards = pgTable('dashboards', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.references(() => user.id)
		.notNull(),
	name: text('name').notNull(),
	query: text('query').notNull(),
	displayData: jsonb('display_data').notNull(),
	explanation: text('explanation'),
	visibility: dashboardVisibility('visibility').default('private').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const dataSources = pgTable('data_sources', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.references(() => user.id)
		.notNull(),
	name: text('name').notNull(),
	connectionString: text('connection_string').notNull(),
	isDefault: boolean('is_default').default(false),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

import {
	pgTable,
	serial,
	text,
	integer,
	uuid,
	jsonb,
	timestamp,
	foreignKey
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const dashboards = pgTable('dashboards', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.references(() => user.id)
		.notNull(),
	name: text('name').notNull(),
	query: text('query').notNull(),
	displayData: jsonb('display_data').notNull(),
	explanation: text('explanation'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

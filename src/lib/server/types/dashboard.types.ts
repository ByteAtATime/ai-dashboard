import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { dashboards, dashboardItems, dashboardItemExecutions } from '$lib/server/db/schema';
import { z } from 'zod';

export const selectDashboardSchema = createSelectSchema(dashboards);
export const selectDashboardItemSchema = createSelectSchema(dashboardItems);
export const selectDashboardItemExecutionSchema = createSelectSchema(dashboardItemExecutions);

export type Dashboard = z.infer<typeof selectDashboardSchema>;
export type DashboardItem = z.infer<typeof selectDashboardItemSchema>;
export type DashboardItemExecution = z.infer<typeof selectDashboardItemExecutionSchema>;

export const insertDashboardSchema = createInsertSchema(dashboards);
export const insertDashboardItemSchema = createInsertSchema(dashboardItems);
export const insertDashboardItemExecutionSchema = createInsertSchema(dashboardItemExecutions);

export type InsertDashboard = z.infer<typeof insertDashboardSchema>;
export type InsertDashboardItem = z.infer<typeof insertDashboardItemSchema>;
export type InsertDashboardItemExecution = z.infer<typeof insertDashboardItemExecutionSchema>;

export const insertFullDashboardSchema = insertDashboardSchema.extend({
	items: z
		.array(insertDashboardItemSchema.omit({ dashboardId: true }))
		.optional()
		.default([])
});
export type InsertFullDashboard = z.infer<typeof insertFullDashboardSchema>;

export const updateDashboardSchema = z.object({
	name: z.string().min(1).optional(),
	visibility: z.enum(dashboards.visibility.enumValues).optional()
});
export type UpdateDashboard = z.infer<typeof updateDashboardSchema>;

export const updateDashboardItemSchema = z.object({
	generatedSql: z.string().min(1).optional(),
	explanation: z.string().nullable().optional(),
	visualizationType: z.string().min(1).optional(),
	layout: z.record(z.unknown()).optional()
});
export type UpdateDashboardItem = z.infer<typeof updateDashboardItemSchema>;

export interface DashboardItemWithLatestExecution extends DashboardItem {
	latestExecution?: DashboardItemExecution | null;
}

export interface FullDashboard extends Dashboard {
	items: DashboardItemWithLatestExecution[];
}

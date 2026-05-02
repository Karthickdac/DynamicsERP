import { pgTable, serial, integer, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectMilestonesTable = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  stage: varchar("stage", { length: 32 }).notNull(),
  plannedDate: date("planned_date"),
  actualDate: date("actual_date"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index("project_milestones_project_idx").on(t.projectId),
}));

export type ProjectMilestoneRow = typeof projectMilestonesTable.$inferSelect;

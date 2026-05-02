import { pgTable, serial, integer, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const projectTasksTable = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assigneeId: integer("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"),
  status: varchar("status", { length: 32 }).notNull().default("todo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index("project_tasks_project_idx").on(t.projectId),
  assigneeIdx: index("project_tasks_assignee_idx").on(t.assigneeId),
}));

export type ProjectTaskRow = typeof projectTasksTable.$inferSelect;

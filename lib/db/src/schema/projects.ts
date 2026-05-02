import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { salesOrdersTable } from "./sales_orders";
import { accountsTable } from "./accounts";
import { contactsTable } from "./contacts";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  projectNumber: varchar("project_number", { length: 32 }).notNull().unique(),
  salesOrderId: integer("sales_order_id").references(() => salesOrdersTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  capacityKwp: numeric("capacity_kwp", { precision: 10, scale: 2 }),
  siteAddress: text("site_address"),
  siteCity: varchar("site_city", { length: 100 }),
  siteState: varchar("site_state", { length: 100 }),
  sitePincode: varchar("site_pincode", { length: 10 }),
  stage: varchar("stage", { length: 32 }).notNull().default("site_survey"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  startDate: date("start_date"),
  expectedEndDate: date("expected_end_date"),
  actualEndDate: date("actual_end_date"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  managerId: integer("manager_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  stageIdx: index("projects_stage_idx").on(t.stage),
  accountIdx: index("projects_account_idx").on(t.accountId),
}));

export type ProjectRow = typeof projectsTable.$inferSelect;

import { pgTable, serial, integer, varchar, text, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { contactsTable } from "./contacts";
import { usersTable } from "./users";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).notNull().default("new"),
  source: varchar("source", { length: 32 }).notNull().default("website"),
  capacityKwp: numeric("capacity_kwp", { precision: 12, scale: 2 }),
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  expectedCloseDate: date("expected_close_date"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  siteAddress: text("site_address"),
  siteCity: varchar("site_city", { length: 120 }),
  siteState: varchar("site_state", { length: 120 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadRow = typeof leadsTable.$inferSelect;
export type InsertLeadRow = typeof leadsTable.$inferInsert;

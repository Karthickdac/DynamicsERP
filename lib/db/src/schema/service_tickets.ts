import { pgTable, serial, integer, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { accountsTable } from "./accounts";
import { contactsTable } from "./contacts";
import { usersTable } from "./users";

export const serviceTicketsTable = pgTable("service_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).notNull().default("complaint"),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  assigneeId: integer("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  reportedAt: date("reported_at").notNull(),
  resolvedAt: date("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("service_tickets_status_idx").on(t.status),
  assigneeIdx: index("service_tickets_assignee_idx").on(t.assigneeId),
}));

export type ServiceTicketRow = typeof serviceTicketsTable.$inferSelect;

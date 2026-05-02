import { pgTable, serial, integer, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { serviceTicketsTable } from "./service_tickets";
import { amcContractsTable } from "./amc_contracts";
import { usersTable } from "./users";

export const serviceVisitsTable = pgTable("service_visits", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => serviceTicketsTable.id, { onDelete: "set null" }),
  amcContractId: integer("amc_contract_id").references(() => amcContractsTable.id, { onDelete: "set null" }),
  scheduledDate: date("scheduled_date").notNull(),
  completedDate: date("completed_date"),
  engineerId: integer("engineer_id").references(() => usersTable.id, { onDelete: "set null" }),
  visitType: varchar("visit_type", { length: 32 }).notNull().default("service"),
  status: varchar("status", { length: 32 }).notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  scheduledIdx: index("service_visits_scheduled_idx").on(t.scheduledDate),
  engineerIdx: index("service_visits_engineer_idx").on(t.engineerId),
}));

export type ServiceVisitRow = typeof serviceVisitsTable.$inferSelect;

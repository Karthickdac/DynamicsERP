import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { accountsTable } from "./accounts";

export const amcContractsTable = pgTable("amc_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: varchar("contract_number", { length: 32 }).notNull().unique(),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  contractValue: numeric("contract_value", { precision: 14, scale: 2 }).notNull().default("0"),
  visitsPerYear: integer("visits_per_year").notNull().default(4),
  coverageDetails: text("coverage_details"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("amc_contracts_status_idx").on(t.status),
  accountIdx: index("amc_contracts_account_idx").on(t.accountId),
}));

export type AmcContractRow = typeof amcContractsTable.$inferSelect;

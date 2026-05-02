import { pgTable, serial, integer, varchar, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads";
import { accountsTable } from "./accounts";

export const estimationsTable = pgTable("estimations", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  capacityKwp: numeric("capacity_kwp", { precision: 12, scale: 2 }).notNull(),
  panelCost: numeric("panel_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  inverterCost: numeric("inverter_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  structureCost: numeric("structure_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  batteryCost: numeric("battery_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  cableCost: numeric("cable_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  installationCost: numeric("installation_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  civilWorksCost: numeric("civil_works_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  otherCost: numeric("other_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  contingencyPct: numeric("contingency_pct", { precision: 5, scale: 2 }).notNull().default("5"),
  marginPct: numeric("margin_pct", { precision: 5, scale: 2 }).notNull().default("15"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EstimationRow = typeof estimationsTable.$inferSelect;

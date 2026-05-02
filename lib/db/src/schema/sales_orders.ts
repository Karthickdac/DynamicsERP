import { pgTable, serial, integer, varchar, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { quotationsTable } from "./quotations";
import { accountsTable } from "./accounts";

export const salesOrdersTable = pgTable("sales_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
  quotationId: integer("quotation_id").references(() => quotationsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("confirmed"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  orderDate: date("order_date").notNull(),
  expectedDeliveryDate: date("expected_delivery_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SalesOrderRow = typeof salesOrdersTable.$inferSelect;

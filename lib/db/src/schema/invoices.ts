import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { salesOrdersTable } from "./sales_orders";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 32 }).notNull().unique(),
  invoiceType: varchar("invoice_type", { length: 16 }).notNull().default("tax"),
  salesOrderId: integer("sales_order_id").references(() => salesOrdersTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  supplyType: varchar("supply_type", { length: 16 }).notNull().default("intra"),
  placeOfSupply: varchar("place_of_supply", { length: 120 }).notNull(),
  buyerGstin: varchar("buyer_gstin", { length: 32 }),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("invoices_status_idx").on(t.status),
  accountIdx: index("invoices_account_idx").on(t.accountId),
  invoiceDateIdx: index("invoices_invoice_date_idx").on(t.invoiceDate),
}));

export type InvoiceRow = typeof invoicesTable.$inferSelect;

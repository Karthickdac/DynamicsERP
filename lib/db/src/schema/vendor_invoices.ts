import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { purchaseOrdersTable } from "./purchase_orders";
import { vendorsTable } from "./vendors";
import { usersTable } from "./users";

export const vendorInvoicesTable = pgTable("vendor_invoices", {
  id: serial("id").primaryKey(),
  vendorInvoiceNumber: varchar("vendor_invoice_number", { length: 64 }).notNull(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrdersTable.id, { onDelete: "set null" }),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 32 }).notNull().default("recorded"),
  notes: text("notes"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vendorIdx: index("vinv_vendor_idx").on(t.vendorId),
  poIdx: index("vinv_po_idx").on(t.purchaseOrderId),
}));

export type VendorInvoiceRow = typeof vendorInvoicesTable.$inferSelect;

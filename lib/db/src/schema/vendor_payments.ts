import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { vendorInvoicesTable } from "./vendor_invoices";
import { vendorsTable } from "./vendors";
import { usersTable } from "./users";

export const vendorPaymentsTable = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  paymentNumber: varchar("payment_number", { length: 32 }).notNull().unique(),
  vendorInvoiceId: integer("vendor_invoice_id").notNull().references(() => vendorInvoicesTable.id, { onDelete: "restrict" }),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMode: varchar("payment_mode", { length: 32 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 64 }),
  notes: text("notes"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  invoiceIdx: index("vpay_invoice_idx").on(t.vendorInvoiceId),
}));

export type VendorPaymentRow = typeof vendorPaymentsTable.$inferSelect;

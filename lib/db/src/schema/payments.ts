import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";
import { accountsTable } from "./accounts";
import { usersTable } from "./users";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  paymentNumber: varchar("payment_number", { length: 32 }).notNull().unique(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMode: varchar("payment_mode", { length: 32 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 64 }),
  notes: text("notes"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
  paymentDateIdx: index("payments_payment_date_idx").on(t.paymentDate),
}));

export type PaymentRow = typeof paymentsTable.$inferSelect;

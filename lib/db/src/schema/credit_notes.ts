import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";
import { accountsTable } from "./accounts";
import { usersTable } from "./users";

export const creditNotesTable = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  creditNoteNumber: varchar("credit_note_number", { length: 32 }).notNull().unique(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "restrict" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("issued"),
  issueDate: date("issue_date").notNull(),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  invoiceIdx: index("credit_notes_invoice_idx").on(t.invoiceId),
}));

export type CreditNoteRow = typeof creditNotesTable.$inferSelect;

import { pgTable, serial, integer, varchar, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads";
import { accountsTable } from "./accounts";
import { contactsTable } from "./contacts";
import { usersTable } from "./users";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: varchar("quotation_number", { length: 32 }).notNull().unique(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  validUntil: date("valid_until"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuotationRow = typeof quotationsTable.$inferSelect;

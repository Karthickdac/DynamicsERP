import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().default("Dynamic Green Energy"),
  legalName: varchar("legal_name", { length: 200 }),
  tagline: varchar("tagline", { length: 200 }),
  logoUrl: text("logo_url"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  website: varchar("website", { length: 255 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 12 }),
  country: varchar("country", { length: 100 }).notNull().default("India"),
  gstin: varchar("gstin", { length: 20 }),
  pan: varchar("pan", { length: 12 }),
  cin: varchar("cin", { length: 32 }),
  bankName: varchar("bank_name", { length: 120 }),
  bankAccountNo: varchar("bank_account_no", { length: 64 }),
  bankIfsc: varchar("bank_ifsc", { length: 16 }),
  bankBranch: varchar("bank_branch", { length: 120 }),
  invoiceFooterNote: text("invoice_footer_note"),
  termsAndConditions: text("terms_and_conditions"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompanySettingsRow = typeof companySettingsTable.$inferSelect;
export type InsertCompanySettingsRow = typeof companySettingsTable.$inferInsert;

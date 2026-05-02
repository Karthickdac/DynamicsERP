import { pgTable, serial, varchar, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  gstin: varchar("gstin", { length: 32 }),
  pan: varchar("pan", { length: 16 }),
  contactPerson: varchar("contact_person", { length: 120 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  addressLine: text("address_line"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 120 }),
  pincode: varchar("pincode", { length: 16 }),
  bankName: varchar("bank_name", { length: 120 }),
  bankAccountNo: varchar("bank_account_no", { length: 64 }),
  ifscCode: varchar("ifsc_code", { length: 32 }),
  category: varchar("category", { length: 64 }),
  rating: integer("rating"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: index("vendors_name_idx").on(t.name),
}));

export type VendorRow = typeof vendorsTable.$inferSelect;

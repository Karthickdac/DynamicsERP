import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 120 }),
  gstin: varchar("gstin", { length: 32 }),
  billingAddress: text("billing_address"),
  billingCity: varchar("billing_city", { length: 120 }),
  billingState: varchar("billing_state", { length: 120 }),
  billingPincode: varchar("billing_pincode", { length: 12 }),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 255 }),
  accountType: varchar("account_type", { length: 32 }).notNull().default("commercial"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountRow = typeof accountsTable.$inferSelect;
export type InsertAccountRow = typeof accountsTable.$inferInsert;

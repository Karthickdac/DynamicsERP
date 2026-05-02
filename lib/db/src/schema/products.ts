import { pgTable, serial, varchar, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 32 }).notNull().default("nos"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  hsnCode: varchar("hsn_code", { length: 16 }),
  manufacturer: varchar("manufacturer", { length: 120 }),
  wattage: numeric("wattage", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductRow = typeof productsTable.$inferSelect;

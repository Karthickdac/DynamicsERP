import { pgTable, serial, integer, varchar, text, numeric } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";
import { productsTable } from "./products";

export const invoiceLineItemsTable = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  description: text("description"),
  hsnCode: varchar("hsn_code", { length: 16 }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull().default("nos"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  position: integer("position").notNull().default(0),
});

export type InvoiceLineItemRow = typeof invoiceLineItemsTable.$inferSelect;

import { pgTable, serial, integer, varchar, text, numeric } from "drizzle-orm/pg-core";
import { quotationsTable } from "./quotations";
import { productsTable } from "./products";

export const quotationLineItemsTable = pgTable("quotation_line_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotationsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull().default("nos"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  position: integer("position").notNull().default(0),
});

export type QuotationLineItemRow = typeof quotationLineItemsTable.$inferSelect;

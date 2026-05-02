import { pgTable, serial, integer, varchar, text, numeric, index } from "drizzle-orm/pg-core";
import { purchaseOrdersTable } from "./purchase_orders";

export const poLineItemsTable = pgTable("po_line_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  description: text("description"),
  hsnCode: varchar("hsn_code", { length: 32 }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("1"),
  receivedQuantity: numeric("received_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  unit: varchar("unit", { length: 32 }).notNull().default("nos"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
}, (t) => ({
  poIdx: index("po_lines_po_idx").on(t.purchaseOrderId),
}));

export type PoLineItemRow = typeof poLineItemsTable.$inferSelect;

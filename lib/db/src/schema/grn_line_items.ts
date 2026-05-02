import { pgTable, serial, integer, numeric, index } from "drizzle-orm/pg-core";
import { goodsReceiptsTable } from "./goods_receipts";
import { poLineItemsTable } from "./po_line_items";

export const grnLineItemsTable = pgTable("grn_line_items", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull().references(() => goodsReceiptsTable.id, { onDelete: "cascade" }),
  poLineItemId: integer("po_line_item_id").notNull().references(() => poLineItemsTable.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
}, (t) => ({
  grnIdx: index("grn_lines_grn_idx").on(t.grnId),
}));

export type GrnLineItemRow = typeof grnLineItemsTable.$inferSelect;

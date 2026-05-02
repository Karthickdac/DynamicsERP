import { pgTable, serial, integer, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { purchaseOrdersTable } from "./purchase_orders";
import { vendorsTable } from "./vendors";
import { usersTable } from "./users";

export const goodsReceiptsTable = pgTable("goods_receipts", {
  id: serial("id").primaryKey(),
  grnNumber: varchar("grn_number", { length: 32 }).notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "restrict" }),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "restrict" }),
  receivedDate: date("received_date").notNull(),
  receivedById: integer("received_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: varchar("status", { length: 16 }).notNull().default("partial"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  poIdx: index("grns_po_idx").on(t.purchaseOrderId),
}));

export type GrnRow = typeof goodsReceiptsTable.$inferSelect;

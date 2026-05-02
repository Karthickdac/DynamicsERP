import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 32 }).notNull().unique(),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "restrict" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  orderDate: date("order_date").notNull(),
  expectedDeliveryDate: date("expected_delivery_date"),
  supplyType: varchar("supply_type", { length: 16 }).notNull().default("intra"),
  placeOfSupply: varchar("place_of_supply", { length: 120 }).notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  approvedById: integer("approved_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("po_status_idx").on(t.status),
  vendorIdx: index("po_vendor_idx").on(t.vendorId),
  projectIdx: index("po_project_idx").on(t.projectId),
}));

export type PurchaseOrderRow = typeof purchaseOrdersTable.$inferSelect;

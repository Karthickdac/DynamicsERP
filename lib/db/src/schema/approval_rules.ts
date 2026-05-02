import { pgTable, serial, integer, varchar, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const approvalRulesTable = pgTable("approval_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  entityType: varchar("entity_type", { length: 32 }).notNull().default("quotation"),
  minAmount: numeric("min_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  maxAmount: numeric("max_amount", { precision: 14, scale: 2 }),
  approverRole: varchar("approver_role", { length: 32 }).notNull(),
  level: integer("level").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalRuleRow = typeof approvalRulesTable.$inferSelect;

import { pgTable, serial, integer, varchar, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { approvalRulesTable } from "./approval_rules";
import { usersTable } from "./users";

export const approvalRequestsTable = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: integer("entity_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  ruleId: integer("rule_id").references(() => approvalRulesTable.id, { onDelete: "set null" }),
  approverRole: varchar("approver_role", { length: 32 }).notNull(),
  approverId: integer("approver_id").references(() => usersTable.id, { onDelete: "set null" }),
  level: integer("level").notNull().default(1),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  comments: text("comments"),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalRequestRow = typeof approvalRequestsTable.$inferSelect;

import { pgTable, serial, integer, varchar, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseNumber: varchar("expense_number", { length: 32 }).notNull().unique(),
  submittedById: integer("submitted_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  category: varchar("category", { length: 32 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expenseDate: date("expense_date").notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  approvedById: integer("approved_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  reimbursedAt: timestamp("reimbursed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("expenses_status_idx").on(t.status),
  projectIdx: index("expenses_project_idx").on(t.projectId),
  submittedIdx: index("expenses_submitted_idx").on(t.submittedById),
}));

export type ExpenseRow = typeof expensesTable.$inferSelect;

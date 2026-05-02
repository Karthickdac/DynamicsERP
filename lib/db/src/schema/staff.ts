import { pgTable, serial, integer, varchar, text, timestamp, date, uniqueIndex, index } from "drizzle-orm/pg-core";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  employeeCode: varchar("employee_code", { length: 64 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  designation: varchar("designation", { length: 120 }),
  department: varchar("department", { length: 120 }),
  reportsToId: integer("reports_to_id"),
  joiningDate: date("joining_date"),
  exitDate: date("exit_date"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  employmentType: varchar("employment_type", { length: 32 }),
  workLocation: varchar("work_location", { length: 120 }),
  notes: text("notes"),
  source: varchar("source", { length: 32 }).notNull().default("manual"),
  externalId: varchar("external_id", { length: 64 }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqEmpCode: uniqueIndex("staff_employee_code_uniq").on(t.employeeCode),
  externalIdx: index("staff_external_idx").on(t.source, t.externalId),
  statusIdx: index("staff_status_idx").on(t.status),
}));

export type StaffRow = typeof staffTable.$inferSelect;
export type InsertStaffRow = typeof staffTable.$inferInsert;

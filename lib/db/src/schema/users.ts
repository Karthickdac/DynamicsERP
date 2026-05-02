import { pgTable, serial, text, timestamp, varchar, boolean, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("sales"),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 32 }),
  designation: varchar("designation", { length: 120 }),
  department: varchar("department", { length: 120 }),
  employeeCode: varchar("employee_code", { length: 64 }),
  isActive: boolean("is_active").notNull().default(true),
  staffId: integer("staff_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof usersTable.$inferSelect;
export type InsertUserRow = typeof usersTable.$inferInsert;

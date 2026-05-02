import { pgTable, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const roleModuleAccessTable = pgTable(
  "role_module_access",
  {
    role: varchar("role", { length: 32 }).notNull(),
    moduleKey: varchar("module_key", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.role, t.moduleKey] }),
  }),
);

export type RoleModuleAccessRow = typeof roleModuleAccessTable.$inferSelect;
export type InsertRoleModuleAccessRow = typeof roleModuleAccessTable.$inferInsert;

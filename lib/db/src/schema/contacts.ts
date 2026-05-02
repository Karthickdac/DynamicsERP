import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 120 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContactRow = typeof contactsTable.$inferSelect;
export type InsertContactRow = typeof contactsTable.$inferInsert;

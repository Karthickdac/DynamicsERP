import { pgTable, serial, varchar, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  body: text("body").notNull(),
  variables: text("variables"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqCode: uniqueIndex("email_templates_code_uniq").on(t.code),
}));

export type EmailTemplateRow = typeof emailTemplatesTable.$inferSelect;
export type InsertEmailTemplateRow = typeof emailTemplatesTable.$inferInsert;

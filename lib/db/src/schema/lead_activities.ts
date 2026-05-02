import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads";
import { usersTable } from "./users";

export const leadActivitiesTable = pgTable("lead_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leadsTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadActivityRow = typeof leadActivitiesTable.$inferSelect;
export type InsertLeadActivityRow = typeof leadActivitiesTable.$inferInsert;

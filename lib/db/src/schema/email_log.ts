import { pgTable, serial, integer, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const emailLogTable = pgTable("email_log", {
  id: serial("id").primaryKey(),
  templateCode: varchar("template_code", { length: 64 }),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: integer("entity_id"),
  toAddresses: text("to_addresses").notNull(),
  ccAddresses: text("cc_addresses"),
  subject: varchar("subject", { length: 300 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  errorMessage: text("error_message"),
  sentById: integer("sent_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("email_log_entity_idx").on(t.entityType, t.entityId),
  sentAtIdx: index("email_log_sent_at_idx").on(t.sentAt),
}));

export type EmailLogRow = typeof emailLogTable.$inferSelect;
export type InsertEmailLogRow = typeof emailLogTable.$inferInsert;

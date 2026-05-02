import { pgTable, serial, varchar, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailSettingsTable = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 16 }).notNull().default("none"),

  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPassword: text("smtp_password"),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  smtpFromName: varchar("smtp_from_name", { length: 255 }),

  resendApiKey: text("resend_api_key"),
  resendFrom: varchar("resend_from", { length: 255 }),
  resendFromName: varchar("resend_from_name", { length: 255 }),

  imapHost: varchar("imap_host", { length: 255 }),
  imapPort: integer("imap_port"),
  imapSecure: boolean("imap_secure").notNull().default(true),
  imapUser: varchar("imap_user", { length: 255 }),
  imapPassword: text("imap_password"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSettingsRow = typeof emailSettingsTable.$inferSelect;
export type InsertEmailSettingsRow = typeof emailSettingsTable.$inferInsert;

import { pgTable, serial, varchar, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const integrationSettingsTable = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  baseUrl: varchar("base_url", { length: 400 }),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  config: text("config"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 16 }),
  lastSyncMessage: text("last_sync_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqProvider: uniqueIndex("integration_settings_provider_uniq").on(t.provider),
}));

export type IntegrationSettingsRow = typeof integrationSettingsTable.$inferSelect;
export type InsertIntegrationSettingsRow = typeof integrationSettingsTable.$inferInsert;

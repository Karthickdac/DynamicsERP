import { pgTable, serial, integer, varchar, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventKey: varchar("event_key", { length: 64 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 400 }),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  emailStatus: varchar("email_status", { length: 16 }),
  pushStatus: varchar("push_status", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("notifications_user_idx").on(t.userId, t.isRead),
  createdIdx: index("notifications_created_idx").on(t.createdAt),
}));

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventKey: varchar("event_key", { length: 64 }).notNull(),
  inApp: boolean("in_app").notNull().default(true),
  email: boolean("email").notNull().default(false),
  push: boolean("push").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqUserEvent: uniqueIndex("notification_preferences_user_event_uniq").on(t.userId, t.eventKey),
}));

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqEndpoint: uniqueIndex("push_subscriptions_endpoint_uniq").on(t.endpoint),
  userIdx: index("push_subscriptions_user_idx").on(t.userId),
}));

export type NotificationRow = typeof notificationsTable.$inferSelect;
export type NotificationPreferenceRow = typeof notificationPreferencesTable.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptionsTable.$inferSelect;

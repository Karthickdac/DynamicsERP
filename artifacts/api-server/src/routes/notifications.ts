import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db, notificationsTable, notificationPreferencesTable, pushSubscriptionsTable,
} from "@workspace/db";
import {
  UpdateNotificationPreferencesBody, SubscribePushBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { EVENT_TYPES, getVapidPublicKey, isEmailEnabled, isPushEnabled } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function notificationDto(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id, userId: n.userId, eventKey: n.eventKey,
    title: n.title, body: n.body, link: n.link,
    entityType: n.entityType, entityId: n.entityId,
    isRead: n.isRead, readAt: n.readAt ? n.readAt.toISOString() : null,
    emailStatus: n.emailStatus, pushStatus: n.pushStatus,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const unreadOnly = req.query.unreadOnly === "true";
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.max(1, Math.floor(rawLimit))) : 50;
  const where = unreadOnly
    ? and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))
    : eq(notificationsTable.userId, userId);
  const rows = await db.select().from(notificationsTable).where(where).orderBy(desc(notificationsTable.createdAt)).limit(limit);
  res.json(rows.map(notificationDto));
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  res.json({ unread: row?.count ?? 0 });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = req.user!.id;
  const [row] = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!row.isRead) {
    await db.update(notificationsTable).set({ isRead: true, readAt: sql`now()` }).where(eq(notificationsTable.id, id));
  }
  const [updated] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
  res.json(notificationDto(updated!));
});

router.post("/notifications/mark-all-read", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  await db.update(notificationsTable).set({ isRead: true, readAt: sql`now()` })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  res.json({ unread: 0 });
});

router.get("/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const stored = await db.select().from(notificationPreferencesTable).where(eq(notificationPreferencesTable.userId, userId));
  const map = new Map(stored.map(p => [p.eventKey, p]));
  const result = EVENT_TYPES.map(ev => {
    const p = map.get(ev.eventKey);
    return {
      eventKey: ev.eventKey, eventLabel: ev.label, category: ev.category,
      inApp: p ? p.inApp : ev.defaultInApp,
      email: p ? p.email : ev.defaultEmail,
      push: p ? p.push : ev.defaultPush,
    };
  });
  res.json(result);
});

router.put("/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateNotificationPreferencesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const userId = req.user!.id;
  const validKeys = new Set(EVENT_TYPES.map(e => e.eventKey));
  for (const p of parsed.data.preferences) {
    if (!validKeys.has(p.eventKey)) continue;
    const [existing] = await db.select().from(notificationPreferencesTable)
      .where(and(eq(notificationPreferencesTable.userId, userId), eq(notificationPreferencesTable.eventKey, p.eventKey)));
    if (existing) {
      await db.update(notificationPreferencesTable).set({
        inApp: p.inApp, email: p.email, push: p.push, updatedAt: sql`now()`,
      }).where(eq(notificationPreferencesTable.id, existing.id));
    } else {
      await db.insert(notificationPreferencesTable).values({
        userId, eventKey: p.eventKey, inApp: p.inApp, email: p.email, push: p.push,
      });
    }
  }
  // Return updated set
  const stored = await db.select().from(notificationPreferencesTable).where(eq(notificationPreferencesTable.userId, userId));
  const map = new Map(stored.map(p => [p.eventKey, p]));
  res.json(EVENT_TYPES.map(ev => {
    const p = map.get(ev.eventKey);
    return {
      eventKey: ev.eventKey, eventLabel: ev.label, category: ev.category,
      inApp: p ? p.inApp : ev.defaultInApp,
      email: p ? p.email : ev.defaultEmail,
      push: p ? p.push : ev.defaultPush,
    };
  }));
});

router.get("/notification-config", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    vapidPublicKey: getVapidPublicKey(),
    emailEnabled: await isEmailEnabled(),
    pushEnabled: isPushEnabled(),
    eventTypes: EVENT_TYPES.map(e => ({ eventKey: e.eventKey, label: e.label, category: e.category, description: e.description })),
  });
});

router.post("/push-subscriptions", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubscribePushBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const userId = req.user!.id;
  const d = parsed.data;
  // Upsert by endpoint
  const [existing] = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, d.endpoint));
  if (existing) {
    await db.update(pushSubscriptionsTable).set({
      userId, p256dh: d.p256dh, auth: d.auth, userAgent: d.userAgent ?? null,
    }).where(eq(pushSubscriptionsTable.id, existing.id));
    const [row] = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, existing.id));
    res.status(201).json({ id: row.id, userId: row.userId, endpoint: row.endpoint, createdAt: row.createdAt.toISOString() });
    return;
  }
  const [row] = await db.insert(pushSubscriptionsTable).values({
    userId, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth, userAgent: d.userAgent ?? null,
  }).returning();
  res.status(201).json({ id: row.id, userId: row.userId, endpoint: row.endpoint, createdAt: row.createdAt.toISOString() });
});

router.delete("/push-subscriptions", requireAuth, async (req, res): Promise<void> => {
  const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : "";
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  const userId = req.user!.id;
  await db.delete(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId))!);
  res.status(204).end();
});

export default router;

import { Router, type IRouter } from "express";
import { db, emailLogTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/authMiddleware";
import { renderForEntity, sendEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/emails/send", requireAuth, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const to: string[] = Array.isArray(b.to) ? b.to.filter((x: unknown) => typeof x === "string" && x.trim().length) : [];
  const cc: string[] = Array.isArray(b.cc) ? b.cc.filter((x: unknown) => typeof x === "string" && x.trim().length) : [];
  if (!to.length) { res.status(400).json({ error: "At least one recipient is required" }); return; }
  if (!b.subject || !b.body) { res.status(400).json({ error: "Subject and body are required" }); return; }
  const result = await sendEmail({
    to, cc,
    subject: b.subject,
    body: b.body,
    templateCode: b.templateCode ?? null,
    entityType: b.entityType ?? null,
    entityId: b.entityId ?? null,
    sentById: req.user!.id,
  });
  res.json(result);
});

router.post("/emails/preview", requireAuth, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.entityType || !b.entityId) { res.status(400).json({ error: "entityType and entityId are required" }); return; }
  const r = await renderForEntity({
    templateId: b.templateId ?? null,
    templateCode: b.templateCode ?? null,
    entityType: b.entityType,
    entityId: b.entityId,
  });
  res.json(r);
});

router.get("/emails/log", requireAuth, async (req, res): Promise<void> => {
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : null;
  const entityId = req.query.entityId ? Number(req.query.entityId) : null;
  const limit = req.query.limit ? Math.min(500, Math.max(1, Number(req.query.limit))) : 100;
  const conds: any[] = [];
  if (entityType) conds.push(eq(emailLogTable.entityType, entityType));
  if (entityId) conds.push(eq(emailLogTable.entityId, entityId));
  const rows = await db.select({
    log: emailLogTable, sentByFirst: usersTable.firstName, sentByLast: usersTable.lastName,
  }).from(emailLogTable)
    .leftJoin(usersTable, eq(usersTable.id, emailLogTable.sentById))
    .where(conds.length ? and(...conds) as any : undefined as any)
    .orderBy(desc(emailLogTable.sentAt))
    .limit(limit);
  res.json(rows.map(({ log, sentByFirst, sentByLast }) => ({
    id: log.id,
    templateCode: log.templateCode,
    entityType: log.entityType,
    entityId: log.entityId,
    toAddresses: log.toAddresses,
    ccAddresses: log.ccAddresses,
    subject: log.subject,
    body: log.body,
    status: log.status,
    errorMessage: log.errorMessage,
    sentById: log.sentById,
    sentByName: sentByFirst ? `${sentByFirst} ${sentByLast ?? ""}`.trim() : null,
    sentAt: log.sentAt.toISOString(),
  })));
});

export default router;

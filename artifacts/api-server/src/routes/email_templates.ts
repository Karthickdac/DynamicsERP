import { Router, type IRouter } from "express";
import { db, emailTemplatesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { ensureSystemTemplates } from "../lib/email";

const router: IRouter = Router();

function dto(r: typeof emailTemplatesTable.$inferSelect) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    subject: r.subject,
    body: r.body,
    variables: r.variables,
    isActive: r.isActive,
    isSystem: r.isSystem,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/email-templates", requireAuth, async (req, res): Promise<void> => {
  await ensureSystemTemplates();
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const isActive = req.query.isActive;
  const conds: any[] = [];
  if (category) conds.push(eq(emailTemplatesTable.category, category));
  if (isActive === "true") conds.push(eq(emailTemplatesTable.isActive, true));
  if (isActive === "false") conds.push(eq(emailTemplatesTable.isActive, false));
  const rows = await db.select().from(emailTemplatesTable).where(conds.length ? and(...conds) as any : undefined as any).orderBy(asc(emailTemplatesTable.category), asc(emailTemplatesTable.name));
  res.json(rows.map(dto));
});

router.get("/email-templates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(dto(row));
});

router.post("/email-templates", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.code || !b.name || !b.category || !b.subject || !b.body) { res.status(400).json({ error: "Missing required fields" }); return; }
  const exists = await db.select({ id: emailTemplatesTable.id }).from(emailTemplatesTable).where(eq(emailTemplatesTable.code, b.code));
  if (exists.length) { res.status(409).json({ error: "Template code already exists" }); return; }
  const [row] = await db.insert(emailTemplatesTable).values({
    code: b.code, name: b.name, category: b.category, subject: b.subject, body: b.body,
    variables: b.variables ?? null, isActive: b.isActive ?? true, isSystem: false,
  }).returning();
  res.status(201).json(dto(row));
});

router.patch("/email-templates/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["name", "category", "subject", "body", "variables", "isActive"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  const [row] = await db.update(emailTemplatesTable).set(update).where(eq(emailTemplatesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(dto(row));
});

router.delete("/email-templates/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.isSystem) { res.status(400).json({ error: "System templates cannot be deleted. You may deactivate them instead." }); return; }
  await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
  res.status(204).end();
});

export default router;

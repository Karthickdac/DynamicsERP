import { Router, type IRouter } from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, estimationsTable } from "@workspace/db";
import { CreateEstimationBody, UpdateEstimationBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function estDto(e: typeof estimationsTable.$inferSelect) {
  const panel = Number(e.panelCost);
  const inv = Number(e.inverterCost);
  const str = Number(e.structureCost);
  const bat = Number(e.batteryCost);
  const cab = Number(e.cableCost);
  const inst = Number(e.installationCost);
  const civ = Number(e.civilWorksCost);
  const oth = Number(e.otherCost);
  const subtotal = panel + inv + str + bat + cab + inst + civ + oth;
  const contingencyPct = Number(e.contingencyPct);
  const marginPct = Number(e.marginPct);
  const contingencyAmount = +(subtotal * contingencyPct / 100).toFixed(2);
  const afterCont = subtotal + contingencyAmount;
  const marginAmount = +(afterCont * marginPct / 100).toFixed(2);
  const totalCost = +(afterCont + marginAmount).toFixed(2);
  return {
    id: e.id,
    leadId: e.leadId,
    accountId: e.accountId,
    title: e.title,
    capacityKwp: Number(e.capacityKwp),
    panelCost: panel, inverterCost: inv, structureCost: str, batteryCost: bat,
    cableCost: cab, installationCost: inst, civilWorksCost: civ, otherCost: oth,
    contingencyPct, marginPct,
    subtotal: +subtotal.toFixed(2),
    contingencyAmount, marginAmount, totalCost,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/estimations", requireAuth, async (req, res): Promise<void> => {
  const leadId = req.query.leadId ? Number(req.query.leadId) : NaN;
  const filters: SQL[] = [];
  if (Number.isFinite(leadId)) filters.push(eq(estimationsTable.leadId, leadId));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await db.select().from(estimationsTable).where(where).orderBy(desc(estimationsTable.createdAt))
    : await db.select().from(estimationsTable).orderBy(desc(estimationsTable.createdAt));
  res.json(rows.map(estDto));
});

router.post("/estimations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateEstimationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(estimationsTable).values({
    leadId: d.leadId ?? null,
    accountId: d.accountId ?? null,
    title: d.title,
    capacityKwp: String(d.capacityKwp),
    panelCost: String(d.panelCost ?? 0),
    inverterCost: String(d.inverterCost ?? 0),
    structureCost: String(d.structureCost ?? 0),
    batteryCost: String(d.batteryCost ?? 0),
    cableCost: String(d.cableCost ?? 0),
    installationCost: String(d.installationCost ?? 0),
    civilWorksCost: String(d.civilWorksCost ?? 0),
    otherCost: String(d.otherCost ?? 0),
    contingencyPct: String(d.contingencyPct ?? 5),
    marginPct: String(d.marginPct ?? 15),
    notes: d.notes ?? null,
  }).returning();
  res.status(201).json(estDto(row));
});

router.get("/estimations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(estimationsTable).where(eq(estimationsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(estDto(row));
});

router.patch("/estimations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateEstimationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  await db.update(estimationsTable).set({
    leadId: d.leadId ?? null,
    accountId: d.accountId ?? null,
    title: d.title,
    capacityKwp: String(d.capacityKwp),
    panelCost: String(d.panelCost ?? 0),
    inverterCost: String(d.inverterCost ?? 0),
    structureCost: String(d.structureCost ?? 0),
    batteryCost: String(d.batteryCost ?? 0),
    cableCost: String(d.cableCost ?? 0),
    installationCost: String(d.installationCost ?? 0),
    civilWorksCost: String(d.civilWorksCost ?? 0),
    otherCost: String(d.otherCost ?? 0),
    contingencyPct: String(d.contingencyPct ?? 5),
    marginPct: String(d.marginPct ?? 15),
    notes: d.notes ?? null,
    updatedAt: sql`now()`,
  }).where(eq(estimationsTable.id, id));
  const [row] = await db.select().from(estimationsTable).where(eq(estimationsTable.id, id));
  res.json(estDto(row));
});

router.delete("/estimations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(estimationsTable).where(eq(estimationsTable.id, id));
  res.status(204).end();
});

export default router;

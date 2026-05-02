import { Router, type IRouter } from "express";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { db, serviceVisitsTable, usersTable } from "@workspace/db";
import { CreateServiceVisitBody, UpdateServiceVisitBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function dateOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

const vSelect = {
  id: serviceVisitsTable.id,
  ticketId: serviceVisitsTable.ticketId,
  amcContractId: serviceVisitsTable.amcContractId,
  scheduledDate: serviceVisitsTable.scheduledDate,
  completedDate: serviceVisitsTable.completedDate,
  engineerId: serviceVisitsTable.engineerId,
  engineerFirst: usersTable.firstName,
  engineerLast: usersTable.lastName,
  visitType: serviceVisitsTable.visitType,
  status: serviceVisitsTable.status,
  notes: serviceVisitsTable.notes,
  createdAt: serviceVisitsTable.createdAt,
  updatedAt: serviceVisitsTable.updatedAt,
};

function visitDto(v: { [K in keyof typeof vSelect]: unknown }) {
  const x = v as Record<string, any>;
  return {
    id: x.id, ticketId: x.ticketId, amcContractId: x.amcContractId,
    scheduledDate: x.scheduledDate, completedDate: x.completedDate,
    engineerId: x.engineerId,
    engineerName: x.engineerFirst ? `${x.engineerFirst} ${x.engineerLast ?? ""}`.trim() : null,
    visitType: x.visitType, status: x.status, notes: x.notes,
    createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(),
  };
}

router.get("/service-visits", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const ticketId = req.query.ticketId ? Number(req.query.ticketId) : NaN;
  const amcContractId = req.query.amcContractId ? Number(req.query.amcContractId) : NaN;
  const engineerId = req.query.engineerId ? Number(req.query.engineerId) : NaN;
  const filters: SQL[] = [];
  if (status) filters.push(eq(serviceVisitsTable.status, status));
  if (Number.isFinite(ticketId)) filters.push(eq(serviceVisitsTable.ticketId, ticketId));
  if (Number.isFinite(amcContractId)) filters.push(eq(serviceVisitsTable.amcContractId, amcContractId));
  if (Number.isFinite(engineerId)) filters.push(eq(serviceVisitsTable.engineerId, engineerId));
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = db.select(vSelect).from(serviceVisitsTable)
    .leftJoin(usersTable, eq(usersTable.id, serviceVisitsTable.engineerId));
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(serviceVisitsTable.scheduledDate))
    : await baseQuery.orderBy(desc(serviceVisitsTable.scheduledDate));
  res.json(rows.map(visitDto));
});

router.post("/service-visits", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateServiceVisitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(serviceVisitsTable).values({
    ticketId: d.ticketId ?? null,
    amcContractId: d.amcContractId ?? null,
    scheduledDate: dateOrNull(d.scheduledDate)!,
    engineerId: d.engineerId ?? null,
    visitType: d.visitType ?? "service",
    notes: d.notes ?? null,
  }).returning();
  const [withU] = await db.select(vSelect).from(serviceVisitsTable)
    .leftJoin(usersTable, eq(usersTable.id, serviceVisitsTable.engineerId))
    .where(eq(serviceVisitsTable.id, row.id));
  res.status(201).json(visitDto(withU));
});

router.patch("/service-visits/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateServiceVisitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.scheduledDate !== undefined) update.scheduledDate = dateOrNull(d.scheduledDate);
  if (d.completedDate !== undefined) update.completedDate = dateOrNull(d.completedDate);
  if (d.engineerId !== undefined) update.engineerId = d.engineerId ?? null;
  if (d.visitType !== undefined) update.visitType = d.visitType;
  if (d.status !== undefined) {
    update.status = d.status;
    if (d.status === "completed" && d.completedDate === undefined) {
      update.completedDate = new Date().toISOString().slice(0, 10);
    }
  }
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  await db.update(serviceVisitsTable).set(update).where(eq(serviceVisitsTable.id, id));
  const [withU] = await db.select(vSelect).from(serviceVisitsTable)
    .leftJoin(usersTable, eq(usersTable.id, serviceVisitsTable.engineerId))
    .where(eq(serviceVisitsTable.id, id));
  res.json(visitDto(withU));
});

router.delete("/service-visits/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(serviceVisitsTable).where(eq(serviceVisitsTable.id, id));
  res.status(204).end();
});

export default router;

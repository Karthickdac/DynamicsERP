import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { db, projectMilestonesTable } from "@workspace/db";
import { CreateProjectMilestoneBody, UpdateProjectMilestoneBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function milestoneDto(m: typeof projectMilestonesTable.$inferSelect) {
  return {
    id: m.id, projectId: m.projectId, name: m.name, description: m.description,
    stage: m.stage, plannedDate: m.plannedDate, actualDate: m.actualDate,
    status: m.status, position: m.position,
    createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
  };
}

function dateOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

router.get("/projects/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(projectMilestonesTable)
    .where(eq(projectMilestonesTable.projectId, id))
    .orderBy(asc(projectMilestonesTable.position));
  res.json(rows.map(milestoneDto));
});

router.post("/projects/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateProjectMilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(projectMilestonesTable).values({
    projectId: id,
    name: d.name,
    description: d.description ?? null,
    stage: d.stage,
    plannedDate: dateOrNull(d.plannedDate),
    position: d.position ?? 0,
  }).returning();
  res.status(201).json(milestoneDto(row));
});

router.patch("/projects/:id/milestones/:milestoneId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  if (id == null || milestoneId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateProjectMilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description ?? null;
  if (d.stage !== undefined) update.stage = d.stage;
  if (d.plannedDate !== undefined) update.plannedDate = dateOrNull(d.plannedDate);
  if (d.actualDate !== undefined) update.actualDate = dateOrNull(d.actualDate);
  if (d.status !== undefined) update.status = d.status;
  if (d.position !== undefined) update.position = d.position ?? 0;
  await db.update(projectMilestonesTable).set(update)
    .where(and(eq(projectMilestonesTable.id, milestoneId), eq(projectMilestonesTable.projectId, id))!);
  const [row] = await db.select().from(projectMilestonesTable).where(eq(projectMilestonesTable.id, milestoneId));
  res.json(milestoneDto(row));
});

router.delete("/projects/:id/milestones/:milestoneId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const milestoneId = parseId(req.params.milestoneId);
  if (id == null || milestoneId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(projectMilestonesTable)
    .where(and(eq(projectMilestonesTable.id, milestoneId), eq(projectMilestonesTable.projectId, id))!);
  res.status(204).end();
});

export default router;

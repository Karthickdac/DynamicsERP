import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, projectTasksTable, usersTable } from "@workspace/db";
import { CreateProjectTaskBody, UpdateProjectTaskBody } from "@workspace/api-zod";
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

const tSelect = {
  id: projectTasksTable.id,
  projectId: projectTasksTable.projectId,
  title: projectTasksTable.title,
  description: projectTasksTable.description,
  assigneeId: projectTasksTable.assigneeId,
  assigneeFirst: usersTable.firstName,
  assigneeLast: usersTable.lastName,
  dueDate: projectTasksTable.dueDate,
  priority: projectTasksTable.priority,
  status: projectTasksTable.status,
  createdAt: projectTasksTable.createdAt,
  updatedAt: projectTasksTable.updatedAt,
};

function taskDto(t: { [K in keyof typeof tSelect]: unknown }) {
  const x = t as Record<string, any>;
  return {
    id: x.id, projectId: x.projectId, title: x.title, description: x.description,
    assigneeId: x.assigneeId,
    assigneeName: x.assigneeFirst ? `${x.assigneeFirst} ${x.assigneeLast ?? ""}`.trim() : null,
    dueDate: x.dueDate, priority: x.priority, status: x.status,
    createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(),
  };
}

router.get("/projects/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select(tSelect).from(projectTasksTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTasksTable.assigneeId))
    .where(eq(projectTasksTable.projectId, id))
    .orderBy(desc(projectTasksTable.createdAt));
  res.json(rows.map(taskDto));
});

router.post("/projects/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateProjectTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(projectTasksTable).values({
    projectId: id,
    title: d.title,
    description: d.description ?? null,
    assigneeId: d.assigneeId ?? null,
    dueDate: dateOrNull(d.dueDate),
    priority: d.priority ?? "medium",
  }).returning();
  const [withUser] = await db.select(tSelect).from(projectTasksTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTasksTable.assigneeId))
    .where(eq(projectTasksTable.id, row.id));
  res.status(201).json(taskDto(withUser));
});

router.patch("/projects/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const taskId = parseId(req.params.taskId);
  if (id == null || taskId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateProjectTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description ?? null;
  if (d.assigneeId !== undefined) update.assigneeId = d.assigneeId ?? null;
  if (d.dueDate !== undefined) update.dueDate = dateOrNull(d.dueDate);
  if (d.priority !== undefined) update.priority = d.priority;
  if (d.status !== undefined) update.status = d.status;
  await db.update(projectTasksTable).set(update)
    .where(and(eq(projectTasksTable.id, taskId), eq(projectTasksTable.projectId, id))!);
  const [withUser] = await db.select(tSelect).from(projectTasksTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTasksTable.assigneeId))
    .where(eq(projectTasksTable.id, taskId));
  res.json(taskDto(withUser));
});

router.delete("/projects/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const taskId = parseId(req.params.taskId);
  if (id == null || taskId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(projectTasksTable)
    .where(and(eq(projectTasksTable.id, taskId), eq(projectTasksTable.projectId, id))!);
  res.status(204).end();
});

export default router;

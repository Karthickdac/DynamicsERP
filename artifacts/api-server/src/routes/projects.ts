import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, asc, sql, type SQL } from "drizzle-orm";
import {
  db, projectsTable, salesOrdersTable, accountsTable, usersTable,
  projectMilestonesTable, projectTasksTable, projectTeamTable,
} from "@workspace/db";
import { CreateProjectBody, UpdateProjectBody, AdvanceProjectStageBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const STAGES = ["site_survey", "design", "procurement", "installation", "testing", "commissioning", "handover"] as const;

const pSelect = {
  id: projectsTable.id,
  projectNumber: projectsTable.projectNumber,
  salesOrderId: projectsTable.salesOrderId,
  salesOrderNumber: salesOrdersTable.orderNumber,
  accountId: projectsTable.accountId,
  accountName: accountsTable.name,
  contactId: projectsTable.contactId,
  name: projectsTable.name,
  description: projectsTable.description,
  capacityKwp: projectsTable.capacityKwp,
  siteAddress: projectsTable.siteAddress,
  siteCity: projectsTable.siteCity,
  siteState: projectsTable.siteState,
  sitePincode: projectsTable.sitePincode,
  stage: projectsTable.stage,
  status: projectsTable.status,
  startDate: projectsTable.startDate,
  expectedEndDate: projectsTable.expectedEndDate,
  actualEndDate: projectsTable.actualEndDate,
  budget: projectsTable.budget,
  managerId: projectsTable.managerId,
  managerFirst: usersTable.firstName,
  managerLast: usersTable.lastName,
  createdAt: projectsTable.createdAt,
  updatedAt: projectsTable.updatedAt,
};

type PRow = Awaited<ReturnType<typeof selectProject>>[number];
function selectProject() {
  return db.select(pSelect).from(projectsTable)
    .leftJoin(salesOrdersTable, eq(salesOrdersTable.id, projectsTable.salesOrderId))
    .leftJoin(accountsTable, eq(accountsTable.id, projectsTable.accountId))
    .leftJoin(usersTable, eq(usersTable.id, projectsTable.managerId));
}

function projectDto(p: PRow) {
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    salesOrderId: p.salesOrderId,
    salesOrderNumber: p.salesOrderNumber,
    accountId: p.accountId,
    accountName: p.accountName,
    contactId: p.contactId,
    name: p.name,
    description: p.description,
    capacityKwp: p.capacityKwp != null ? Number(p.capacityKwp) : null,
    siteAddress: p.siteAddress,
    siteCity: p.siteCity,
    siteState: p.siteState,
    sitePincode: p.sitePincode,
    stage: p.stage,
    status: p.status,
    startDate: p.startDate,
    expectedEndDate: p.expectedEndDate,
    actualEndDate: p.actualEndDate,
    budget: p.budget != null ? Number(p.budget) : null,
    managerId: p.managerId,
    managerName: p.managerFirst ? `${p.managerFirst} ${p.managerLast ?? ""}`.trim() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function nextProjectNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: projectsTable.id }).from(projectsTable);
  return `PRJ-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

function dateOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const stage = typeof req.query.stage === "string" ? req.query.stage : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const managerId = req.query.managerId ? Number(req.query.managerId) : NaN;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters: SQL[] = [];
  if (stage) filters.push(eq(projectsTable.stage, stage));
  if (status) filters.push(eq(projectsTable.status, status));
  if (Number.isFinite(managerId)) filters.push(eq(projectsTable.managerId, managerId));
  if (search) {
    const or1 = or(
      ilike(projectsTable.name, `%${search}%`),
      ilike(projectsTable.projectNumber, `%${search}%`),
    );
    if (or1) filters.push(or1);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectProject();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(projectsTable.updatedAt))
    : await baseQuery.orderBy(desc(projectsTable.updatedAt));
  res.json(rows.map(projectDto));
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const number = await nextProjectNumber();
  const [row] = await db.insert(projectsTable).values({
    projectNumber: number,
    salesOrderId: d.salesOrderId ?? null,
    accountId: d.accountId ?? null,
    contactId: d.contactId ?? null,
    name: d.name,
    description: d.description ?? null,
    capacityKwp: d.capacityKwp != null ? String(d.capacityKwp) : null,
    siteAddress: d.siteAddress ?? null,
    siteCity: d.siteCity ?? null,
    siteState: d.siteState ?? null,
    sitePincode: d.sitePincode ?? null,
    startDate: dateOrNull(d.startDate),
    expectedEndDate: dateOrNull(d.expectedEndDate),
    budget: d.budget != null ? String(d.budget) : null,
    managerId: d.managerId ?? null,
  }).returning({ id: projectsTable.id });
  // Auto-create default milestones for each stage
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    await db.insert(projectMilestonesTable).values({
      projectId: row.id,
      name: stage.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
      stage,
      status: "pending",
      position: i,
    });
  }
  const [out] = await selectProject().where(eq(projectsTable.id, row.id));
  res.status(201).json(projectDto(out));
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectProject().where(eq(projectsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const milestones = await db.select().from(projectMilestonesTable)
    .where(eq(projectMilestonesTable.projectId, id))
    .orderBy(asc(projectMilestonesTable.position));
  const tasks = await db.select({
    id: projectTasksTable.id, projectId: projectTasksTable.projectId,
    title: projectTasksTable.title, description: projectTasksTable.description,
    assigneeId: projectTasksTable.assigneeId,
    assigneeFirst: usersTable.firstName, assigneeLast: usersTable.lastName,
    dueDate: projectTasksTable.dueDate, priority: projectTasksTable.priority,
    status: projectTasksTable.status,
    createdAt: projectTasksTable.createdAt, updatedAt: projectTasksTable.updatedAt,
  }).from(projectTasksTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTasksTable.assigneeId))
    .where(eq(projectTasksTable.projectId, id))
    .orderBy(desc(projectTasksTable.createdAt));
  const team = await db.select({
    id: projectTeamTable.id, projectId: projectTeamTable.projectId,
    userId: projectTeamTable.userId, role: projectTeamTable.role,
    userFirst: usersTable.firstName, userLast: usersTable.lastName,
    userRole: usersTable.role,
    createdAt: projectTeamTable.createdAt,
  }).from(projectTeamTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTeamTable.userId))
    .where(eq(projectTeamTable.projectId, id));
  res.json({
    ...projectDto(row),
    milestones: milestones.map(m => ({
      id: m.id, projectId: m.projectId, name: m.name, description: m.description,
      stage: m.stage, plannedDate: m.plannedDate, actualDate: m.actualDate,
      status: m.status, position: m.position,
      createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
    })),
    tasks: tasks.map(t => ({
      id: t.id, projectId: t.projectId, title: t.title, description: t.description,
      assigneeId: t.assigneeId,
      assigneeName: t.assigneeFirst ? `${t.assigneeFirst} ${t.assigneeLast ?? ""}`.trim() : null,
      dueDate: t.dueDate, priority: t.priority, status: t.status,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    })),
    team: team.map(t => ({
      id: t.id, projectId: t.projectId, userId: t.userId,
      userName: t.userFirst ? `${t.userFirst} ${t.userLast ?? ""}`.trim() : null,
      userRole: t.userRole, role: t.role,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description ?? null;
  if (d.capacityKwp !== undefined) update.capacityKwp = d.capacityKwp != null ? String(d.capacityKwp) : null;
  if (d.siteAddress !== undefined) update.siteAddress = d.siteAddress ?? null;
  if (d.siteCity !== undefined) update.siteCity = d.siteCity ?? null;
  if (d.siteState !== undefined) update.siteState = d.siteState ?? null;
  if (d.sitePincode !== undefined) update.sitePincode = d.sitePincode ?? null;
  if (d.stage !== undefined) update.stage = d.stage;
  if (d.status !== undefined) update.status = d.status;
  if (d.startDate !== undefined) update.startDate = dateOrNull(d.startDate);
  if (d.expectedEndDate !== undefined) update.expectedEndDate = dateOrNull(d.expectedEndDate);
  if (d.actualEndDate !== undefined) update.actualEndDate = dateOrNull(d.actualEndDate);
  if (d.budget !== undefined) update.budget = d.budget != null ? String(d.budget) : null;
  if (d.managerId !== undefined) update.managerId = d.managerId ?? null;
  await db.update(projectsTable).set(update).where(eq(projectsTable.id, id));
  const [out] = await selectProject().where(eq(projectsTable.id, id));
  res.json(projectDto(out));
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).end();
});

router.post("/projects/:id/advance-stage", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AdvanceProjectStageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const newStage = parsed.data.stage;
  const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  if (p.status === "completed" || p.status === "cancelled") {
    res.status(409).json({ error: `Cannot advance a ${p.status} project` }); return;
  }
  if (p.stage === newStage) {
    res.status(409).json({ error: `Project is already in stage ${newStage}` }); return;
  }
  const fromStage = p.stage;
  try {
    await db.transaction(async (tx) => {
      // Optimistic concurrency: only advance if stage is still what we read
      const upd = await tx.update(projectsTable)
        .set({
          stage: newStage,
          ...(newStage === "handover"
            ? { status: "completed", actualEndDate: new Date().toISOString().slice(0, 10) }
            : {}),
          updatedAt: sql`now()`,
        })
        .where(and(eq(projectsTable.id, id), eq(projectsTable.stage, fromStage))!)
        .returning({ id: projectsTable.id });
      if (upd.length === 0) {
        throw new Error("STAGE_CONFLICT");
      }
      await tx.update(projectMilestonesTable)
        .set({ status: "completed", actualDate: new Date().toISOString().slice(0, 10), updatedAt: sql`now()` })
        .where(and(eq(projectMilestonesTable.projectId, id), eq(projectMilestonesTable.stage, fromStage))!);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "STAGE_CONFLICT") {
      res.status(409).json({ error: "Project stage was modified concurrently. Reload and try again." });
      return;
    }
    throw e;
  }
  const [out] = await selectProject().where(eq(projectsTable.id, id));
  res.json(projectDto(out));
});

export default router;

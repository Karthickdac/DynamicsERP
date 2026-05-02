import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, projectTeamTable, usersTable } from "@workspace/db";
import { AddProjectTeamMemberBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

router.get("/projects/:id/team", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select({
    id: projectTeamTable.id, projectId: projectTeamTable.projectId,
    userId: projectTeamTable.userId, role: projectTeamTable.role,
    userFirst: usersTable.firstName, userLast: usersTable.lastName, userRole: usersTable.role,
    createdAt: projectTeamTable.createdAt,
  }).from(projectTeamTable)
    .leftJoin(usersTable, eq(usersTable.id, projectTeamTable.userId))
    .where(eq(projectTeamTable.projectId, id));
  res.json(rows.map(r => ({
    id: r.id, projectId: r.projectId, userId: r.userId,
    userName: r.userFirst ? `${r.userFirst} ${r.userLast ?? ""}`.trim() : null,
    userRole: r.userRole, role: r.role,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/projects/:id/team", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AddProjectTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const [row] = await db.insert(projectTeamTable).values({
      projectId: id, userId: d.userId, role: d.role ?? "engineer",
    }).returning();
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, row.userId));
    res.status(201).json({
      id: row.id, projectId: row.projectId, userId: row.userId,
      userName: u ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null,
      userRole: u?.role ?? null, role: row.role,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e: any) {
    res.status(409).json({ error: "User already on team" });
  }
});

router.delete("/projects/:id/team/:memberId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const memberId = parseId(req.params.memberId);
  if (id == null || memberId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(projectTeamTable)
    .where(and(eq(projectTeamTable.id, memberId), eq(projectTeamTable.projectId, id))!);
  res.status(204).end();
});

export default router;

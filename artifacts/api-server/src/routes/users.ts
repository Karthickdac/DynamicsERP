import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql, and, or, ilike } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody, ResetUserPasswordBody } from "@workspace/api-zod";
import { hashPassword, publicUser } from "../lib/auth";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/users", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
  const isActiveQ = req.query.isActive;
  const conds: any[] = [];
  if (search) {
    conds.push(or(
      ilike(usersTable.firstName, `%${search}%`),
      ilike(usersTable.lastName, `%${search}%`),
      ilike(usersTable.email, `%${search}%`),
    ));
  }
  if (role) conds.push(eq(usersTable.role, role));
  if (isActiveQ === "true") conds.push(eq(usersTable.isActive, true));
  if (isActiveQ === "false") conds.push(eq(usersTable.isActive, false));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(usersTable).where(where as any).orderBy(usersTable.firstName);
  res.json(rows.map(publicUser));
});

router.get("/users/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(publicUser(row));
});

router.post("/users", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (exists.length) { res.status(409).json({ error: "Email already in use" }); return; }
  const passwordHash = await hashPassword(data.password);
  const [row] = await db.insert(usersTable).values({
    email,
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    phone: data.phone ?? null,
    designation: data.designation ?? null,
    department: data.department ?? null,
    employeeCode: data.employeeCode ?? null,
    isActive: data.isActive ?? true,
    staffId: data.staffId ?? null,
  }).returning();
  res.status(201).json(publicUser(row));
});

router.patch("/users/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.email !== undefined) update.email = data.email.toLowerCase();
  if (data.firstName !== undefined) update.firstName = data.firstName;
  if (data.lastName !== undefined) update.lastName = data.lastName;
  if (data.role !== undefined) update.role = data.role;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.designation !== undefined) update.designation = data.designation;
  if (data.department !== undefined) update.department = data.department;
  if (data.employeeCode !== undefined) update.employeeCode = data.employeeCode;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  if (data.staffId !== undefined) update.staffId = data.staffId;
  if (data.password) {
    update.passwordHash = await hashPassword(data.password);
  }
  if (Object.keys(update).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [row] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(publicUser(row));
});

router.delete("/users/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
  // Invalidate all sessions for the deactivated user.
  const { sessionsTable } = await import("@workspace/db");
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, id));
  res.status(204).end();
});

router.post("/users/:id/reset-password", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const r = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  res.status(204).end();
  void r; void sql;
});

export default router;

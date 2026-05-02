import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql, and, or, ilike } from "drizzle-orm";
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
  const b = req.body ?? {};
  if (!b.email || !b.firstName || !b.lastName || !b.role) { res.status(400).json({ error: "Missing required fields" }); return; }
  if (!b.password || String(b.password).length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
  const exists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, String(b.email).toLowerCase()));
  if (exists.length) { res.status(409).json({ error: "Email already in use" }); return; }
  const passwordHash = await hashPassword(String(b.password));
  const [row] = await db.insert(usersTable).values({
    email: String(b.email).toLowerCase(),
    passwordHash,
    firstName: b.firstName,
    lastName: b.lastName,
    role: b.role,
    phone: b.phone ?? null,
    designation: b.designation ?? null,
    department: b.department ?? null,
    employeeCode: b.employeeCode ?? null,
    isActive: b.isActive ?? true,
    staffId: b.staffId ?? null,
  }).returning();
  res.status(201).json(publicUser(row));
});

router.patch("/users/:id", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  const update: Record<string, unknown> = {};
  for (const k of ["email", "firstName", "lastName", "role", "phone", "designation", "department", "employeeCode", "isActive", "staffId"]) {
    if (b[k] !== undefined) update[k] = k === "email" ? String(b[k]).toLowerCase() : b[k];
  }
  if (b.password && String(b.password).length >= 8) {
    update.passwordHash = await hashPassword(String(b.password));
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
  const password = String(req.body?.password ?? "");
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
  const passwordHash = await hashPassword(password);
  const r = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  res.status(204).end();
  void r; void sql;
});

export default router;

import { Router, type IRouter } from "express";
import { db, staffTable, integrationSettingsTable } from "@workspace/db";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function dto(r: typeof staffTable.$inferSelect, reportsToName: string | null = null) {
  return {
    id: r.id,
    employeeCode: r.employeeCode,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    designation: r.designation,
    department: r.department,
    reportsToId: r.reportsToId,
    reportsToName,
    joiningDate: r.joiningDate,
    exitDate: r.exitDate,
    status: r.status,
    employmentType: r.employmentType,
    workLocation: r.workLocation,
    notes: r.notes,
    source: r.source,
    externalId: r.externalId,
    lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/staff", requireAuth, requireRole(["admin", "hr"]), async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const department = typeof req.query.department === "string" ? req.query.department.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const conds: any[] = [];
  if (search) {
    conds.push(or(
      ilike(staffTable.firstName, `%${search}%`),
      ilike(staffTable.lastName, `%${search}%`),
      ilike(staffTable.email, `%${search}%`),
      ilike(staffTable.employeeCode, `%${search}%`),
    ));
  }
  if (department) conds.push(eq(staffTable.department, department));
  if (status) conds.push(eq(staffTable.status, status));
  const rows = await db.select().from(staffTable).where(conds.length ? and(...conds) as any : undefined as any).orderBy(asc(staffTable.firstName));
  const map = new Map(rows.map(r => [r.id, `${r.firstName} ${r.lastName}`]));
  res.json(rows.map(r => dto(r, r.reportsToId ? (map.get(r.reportsToId) ?? null) : null)));
});

router.get("/staff/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(staffTable).where(eq(staffTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  let mgr: string | null = null;
  if (row.reportsToId) {
    const [m] = await db.select().from(staffTable).where(eq(staffTable.id, row.reportsToId));
    if (m) mgr = `${m.firstName} ${m.lastName}`;
  }
  res.json(dto(row, mgr));
});

router.post("/staff", requireAuth, requireRole(["admin", "hr"]), async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.employeeCode || !b.firstName || !b.lastName) { res.status(400).json({ error: "Missing required fields" }); return; }
  const exists = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.employeeCode, b.employeeCode));
  if (exists.length) { res.status(409).json({ error: "Employee code already exists" }); return; }
  const [row] = await db.insert(staffTable).values({
    employeeCode: b.employeeCode,
    firstName: b.firstName,
    lastName: b.lastName,
    email: b.email ?? null,
    phone: b.phone ?? null,
    designation: b.designation ?? null,
    department: b.department ?? null,
    reportsToId: b.reportsToId ?? null,
    joiningDate: b.joiningDate ?? null,
    exitDate: b.exitDate ?? null,
    status: b.status ?? "active",
    employmentType: b.employmentType ?? null,
    workLocation: b.workLocation ?? null,
    notes: b.notes ?? null,
    source: "manual",
  }).returning();
  res.status(201).json(dto(row));
});

router.patch("/staff/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["employeeCode", "firstName", "lastName", "email", "phone", "designation", "department", "reportsToId", "joiningDate", "exitDate", "status", "employmentType", "workLocation", "notes"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  const [row] = await db.update(staffTable).set(update).where(eq(staffTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(dto(row));
});

router.delete("/staff/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.update(staffTable).set({ status: "inactive", exitDate: new Date().toISOString().slice(0, 10), updatedAt: new Date() }).where(eq(staffTable.id, id));
  res.status(204).end();
});

router.post("/staff/sync-mysticshr", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  const startedAt = new Date();
  const [cfg] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.provider, "mysticshr"));
  if (!cfg || !cfg.enabled || !cfg.baseUrl || !cfg.apiKey) {
    const message = "MysticsHR is not configured. Add API base URL and API key under Admin > Integrations and enable the connector.";
    if (cfg) {
      await db.update(integrationSettingsTable).set({
        lastSyncAt: new Date(), lastSyncStatus: "skipped", lastSyncMessage: message, updatedAt: new Date(),
      }).where(eq(integrationSettingsTable.id, cfg.id));
    }
    res.json({ status: "skipped", message, imported: 0, updated: 0, failed: 0, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() });
    return;
  }
  // Real implementation would fetch from cfg.baseUrl using cfg.apiKey.
  // Awaiting MysticsHR API details from product owner.
  const message = "Connector enabled, awaiting MysticsHR endpoint details. No records imported in this run.";
  await db.update(integrationSettingsTable).set({
    lastSyncAt: new Date(), lastSyncStatus: "pending", lastSyncMessage: message, updatedAt: new Date(),
  }).where(eq(integrationSettingsTable.id, cfg.id));
  res.json({ status: "pending", message, imported: 0, updated: 0, failed: 0, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() });
});

export default router;

import { Router, type IRouter } from "express";
import { db, staffTable, integrationSettingsTable } from "@workspace/db";
import { eq, and, or, ilike, asc, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { fetchAllEmployees, MysticsHrApiError, type MysticsHrEmployee } from "../lib/mysticshr";
import { logger } from "../lib/logger";

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

router.post("/staff/sync-mysticshr", requireAuth, requireRole(["admin", "hr"]), async (_req, res): Promise<void> => {
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

  let imported = 0;
  let updated = 0;
  let failed = 0;
  let employees: MysticsHrEmployee[] = [];
  let parseFailures: Array<{ raw: unknown; reason: string }> = [];

  try {
    const result = await fetchAllEmployees({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    employees = result.employees;
    parseFailures = result.parseFailures;
    failed += parseFailures.length;
  } catch (err: any) {
    const status = err instanceof MysticsHrApiError ? `failed (${err.status || "network"})` : "failed";
    const message = `MysticsHR sync failed: ${err?.message ?? String(err)}`;
    logger.error({ err: err?.message }, "MysticsHR sync aborted");
    await db.update(integrationSettingsTable).set({
      lastSyncAt: new Date(), lastSyncStatus: "failed", lastSyncMessage: message.slice(0, 1000), updatedAt: new Date(),
    }).where(eq(integrationSettingsTable.id, cfg.id));
    res.status(502).json({
      status, message, imported: 0, updated: 0, failed: 0,
      startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
    });
    return;
  }

  // Look up existing staff by (source=mysticshr, externalId) in one query.
  const externalIds = employees.map(e => e.externalId);
  const existingRows = externalIds.length
    ? await db.select().from(staffTable).where(and(eq(staffTable.source, "mysticshr"), inArray(staffTable.externalId, externalIds)))
    : [];
  const existingByExternal = new Map(existingRows.map(r => [r.externalId ?? "", r]));

  // First pass: upsert all employees (without setting reportsToId — we resolve managers second).
  const externalIdToStaffId = new Map<string, number>();
  const managerByExternalId = new Map<string, string>();

  for (const emp of employees) {
    if (emp.managerExternalId) managerByExternalId.set(emp.externalId, emp.managerExternalId);
    try {
      const existing = existingByExternal.get(emp.externalId);
      const now = new Date();
      const base = {
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        designation: emp.designation,
        department: emp.department,
        joiningDate: emp.joiningDate,
        exitDate: emp.exitDate,
        status: emp.status,
        employmentType: emp.employmentType,
        workLocation: emp.workLocation,
        source: "mysticshr" as const,
        externalId: emp.externalId,
        lastSyncedAt: now,
        updatedAt: now,
      };

      if (existing) {
        const [row] = await db.update(staffTable).set(base).where(eq(staffTable.id, existing.id)).returning();
        if (row) { externalIdToStaffId.set(emp.externalId, row.id); updated++; }
      } else {
        // employeeCode is uniquely indexed; if a manual record already uses it, claim it.
        const [byCode] = await db.select().from(staffTable).where(eq(staffTable.employeeCode, emp.employeeCode));
        if (byCode) {
          const [row] = await db.update(staffTable).set(base).where(eq(staffTable.id, byCode.id)).returning();
          if (row) { externalIdToStaffId.set(emp.externalId, row.id); updated++; }
        } else {
          const [row] = await db.insert(staffTable).values(base).returning();
          if (row) { externalIdToStaffId.set(emp.externalId, row.id); imported++; }
        }
      }
    } catch (err: any) {
      failed++;
      logger.warn({ externalId: emp.externalId, err: err?.message }, "MysticsHR upsert failed");
    }
  }

  // Second pass: resolve manager links (reportsToId) now that all rows exist.
  let managersLinked = 0;
  for (const [empExternalId, mgrExternalId] of managerByExternalId) {
    const empId = externalIdToStaffId.get(empExternalId);
    let mgrId = externalIdToStaffId.get(mgrExternalId);
    if (!empId) continue;
    if (!mgrId) {
      // Manager wasn't part of this batch — try the DB.
      const [mgrRow] = await db.select({ id: staffTable.id }).from(staffTable)
        .where(and(eq(staffTable.source, "mysticshr"), eq(staffTable.externalId, mgrExternalId)));
      if (mgrRow) mgrId = mgrRow.id;
    }
    if (!mgrId || mgrId === empId) continue;
    try {
      await db.update(staffTable).set({ reportsToId: mgrId, updatedAt: new Date() }).where(eq(staffTable.id, empId));
      managersLinked++;
    } catch (err: any) {
      logger.warn({ empId, mgrId, err: err?.message }, "MysticsHR manager link failed");
    }
  }

  const finishedAt = new Date();
  const status = failed > 0 ? (imported + updated > 0 ? "partial" : "failed") : "success";
  const message = [
    `Imported ${imported}, updated ${updated}, failed ${failed}.`,
    managersLinked > 0 ? `Manager links resolved: ${managersLinked}.` : null,
    parseFailures.length > 0 ? `${parseFailures.length} record(s) skipped due to invalid shape.` : null,
  ].filter(Boolean).join(" ");

  await db.update(integrationSettingsTable).set({
    lastSyncAt: finishedAt, lastSyncStatus: status, lastSyncMessage: message.slice(0, 1000), updatedAt: finishedAt,
  }).where(eq(integrationSettingsTable.id, cfg.id));

  res.json({
    status, message, imported, updated, failed,
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
  });
});

export default router;

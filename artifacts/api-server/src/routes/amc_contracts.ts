import { Router, type IRouter } from "express";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { db, amcContractsTable, accountsTable, projectsTable } from "@workspace/db";
import { CreateAmcContractBody, UpdateAmcContractBody } from "@workspace/api-zod";
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

const cSelect = {
  id: amcContractsTable.id, contractNumber: amcContractsTable.contractNumber,
  projectId: amcContractsTable.projectId, projectName: projectsTable.name,
  accountId: amcContractsTable.accountId, accountName: accountsTable.name,
  startDate: amcContractsTable.startDate, endDate: amcContractsTable.endDate,
  contractValue: amcContractsTable.contractValue,
  visitsPerYear: amcContractsTable.visitsPerYear,
  coverageDetails: amcContractsTable.coverageDetails,
  status: amcContractsTable.status,
  createdAt: amcContractsTable.createdAt, updatedAt: amcContractsTable.updatedAt,
};

function contractDto(c: { [K in keyof typeof cSelect]: unknown }) {
  const x = c as Record<string, any>;
  return {
    id: x.id, contractNumber: x.contractNumber,
    projectId: x.projectId, projectName: x.projectName,
    accountId: x.accountId, accountName: x.accountName,
    startDate: x.startDate, endDate: x.endDate,
    contractValue: Number(x.contractValue), visitsPerYear: x.visitsPerYear,
    coverageDetails: x.coverageDetails, status: x.status,
    createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(),
  };
}

function selectContract() {
  return db.select(cSelect).from(amcContractsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, amcContractsTable.projectId))
    .leftJoin(accountsTable, eq(accountsTable.id, amcContractsTable.accountId));
}

async function nextContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: amcContractsTable.id }).from(amcContractsTable);
  return `AMC-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

router.get("/amc-contracts", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const filters: SQL[] = [];
  if (status) filters.push(eq(amcContractsTable.status, status));
  if (Number.isFinite(accountId)) filters.push(eq(amcContractsTable.accountId, accountId));
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectContract();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(amcContractsTable.createdAt))
    : await baseQuery.orderBy(desc(amcContractsTable.createdAt));
  res.json(rows.map(contractDto));
});

router.post("/amc-contracts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateAmcContractBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const number = await nextContractNumber();
  const [row] = await db.insert(amcContractsTable).values({
    contractNumber: number,
    projectId: d.projectId ?? null,
    accountId: d.accountId ?? null,
    startDate: dateOrNull(d.startDate)!,
    endDate: dateOrNull(d.endDate)!,
    contractValue: d.contractValue != null ? String(d.contractValue) : "0",
    visitsPerYear: d.visitsPerYear ?? 4,
    coverageDetails: d.coverageDetails ?? null,
  }).returning({ id: amcContractsTable.id });
  const [out] = await selectContract().where(eq(amcContractsTable.id, row.id));
  res.status(201).json(contractDto(out));
});

router.get("/amc-contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectContract().where(eq(amcContractsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(contractDto(row));
});

router.patch("/amc-contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAmcContractBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.startDate !== undefined) update.startDate = dateOrNull(d.startDate);
  if (d.endDate !== undefined) update.endDate = dateOrNull(d.endDate);
  if (d.contractValue !== undefined) update.contractValue = String(d.contractValue);
  if (d.visitsPerYear !== undefined) update.visitsPerYear = d.visitsPerYear;
  if (d.coverageDetails !== undefined) update.coverageDetails = d.coverageDetails ?? null;
  if (d.status !== undefined) update.status = d.status;
  await db.update(amcContractsTable).set(update).where(eq(amcContractsTable.id, id));
  const [out] = await selectContract().where(eq(amcContractsTable.id, id));
  res.json(contractDto(out));
});

router.delete("/amc-contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(amcContractsTable).where(eq(amcContractsTable.id, id));
  res.status(204).end();
});

export default router;

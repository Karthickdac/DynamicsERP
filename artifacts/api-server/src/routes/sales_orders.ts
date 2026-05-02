import { Router, type IRouter } from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, salesOrdersTable, accountsTable } from "@workspace/db";
import { UpdateSalesOrderBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const orderSelect = {
  id: salesOrdersTable.id,
  orderNumber: salesOrdersTable.orderNumber,
  quotationId: salesOrdersTable.quotationId,
  accountId: salesOrdersTable.accountId,
  accountName: accountsTable.name,
  title: salesOrdersTable.title,
  status: salesOrdersTable.status,
  total: salesOrdersTable.total,
  orderDate: salesOrdersTable.orderDate,
  expectedDeliveryDate: salesOrdersTable.expectedDeliveryDate,
  notes: salesOrdersTable.notes,
  createdAt: salesOrdersTable.createdAt,
  updatedAt: salesOrdersTable.updatedAt,
};

function orderDto(o: typeof orderSelect extends infer T ? { [K in keyof T]: any } : never) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    quotationId: o.quotationId,
    accountId: o.accountId,
    accountName: o.accountName,
    title: o.title,
    status: o.status,
    total: Number(o.total),
    orderDate: o.orderDate,
    expectedDeliveryDate: o.expectedDeliveryDate,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/sales-orders", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const filters: SQL[] = [];
  if (status) filters.push(eq(salesOrdersTable.status, status));
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = db.select(orderSelect).from(salesOrdersTable)
    .leftJoin(accountsTable, eq(accountsTable.id, salesOrdersTable.accountId));
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(salesOrdersTable.createdAt))
    : await baseQuery.orderBy(desc(salesOrdersTable.createdAt));
  res.json(rows.map(orderDto));
});

router.get("/sales-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select(orderSelect).from(salesOrdersTable)
    .leftJoin(accountsTable, eq(accountsTable.id, salesOrdersTable.accountId))
    .where(eq(salesOrdersTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(orderDto(row));
});

router.patch("/sales-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSalesOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.status !== undefined) update.status = d.status;
  if (d.expectedDeliveryDate !== undefined) update.expectedDeliveryDate = d.expectedDeliveryDate ?? null;
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  await db.update(salesOrdersTable).set(update).where(eq(salesOrdersTable.id, id));
  const [row] = await db.select(orderSelect).from(salesOrdersTable)
    .leftJoin(accountsTable, eq(accountsTable.id, salesOrdersTable.accountId))
    .where(eq(salesOrdersTable.id, id));
  res.json(orderDto(row));
});

export default router;

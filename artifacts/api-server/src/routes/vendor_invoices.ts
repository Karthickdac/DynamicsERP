import { Router, type IRouter } from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import {
  db, vendorInvoicesTable, vendorsTable, purchaseOrdersTable,
} from "@workspace/db";
import { CreateVendorInvoiceBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const viSelect = {
  id: vendorInvoicesTable.id,
  vendorInvoiceNumber: vendorInvoicesTable.vendorInvoiceNumber,
  purchaseOrderId: vendorInvoicesTable.purchaseOrderId,
  poNumber: purchaseOrdersTable.poNumber,
  vendorId: vendorInvoicesTable.vendorId,
  vendorName: vendorsTable.name,
  amount: vendorInvoicesTable.amount,
  paidAmount: vendorInvoicesTable.paidAmount,
  invoiceDate: vendorInvoicesTable.invoiceDate,
  dueDate: vendorInvoicesTable.dueDate,
  status: vendorInvoicesTable.status,
  notes: vendorInvoicesTable.notes,
  recordedById: vendorInvoicesTable.recordedById,
  createdAt: vendorInvoicesTable.createdAt,
};

function selectVi() {
  return db.select(viSelect).from(vendorInvoicesTable)
    .leftJoin(vendorsTable, eq(vendorsTable.id, vendorInvoicesTable.vendorId))
    .leftJoin(purchaseOrdersTable, eq(purchaseOrdersTable.id, vendorInvoicesTable.purchaseOrderId));
}

function viDto(v: Awaited<ReturnType<typeof selectVi>>[number]) {
  return {
    id: v.id, vendorInvoiceNumber: v.vendorInvoiceNumber,
    purchaseOrderId: v.purchaseOrderId, poNumber: v.poNumber,
    vendorId: v.vendorId, vendorName: v.vendorName,
    amount: Number(v.amount), paidAmount: Number(v.paidAmount),
    invoiceDate: v.invoiceDate, dueDate: v.dueDate,
    status: v.status, notes: v.notes, recordedById: v.recordedById,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/vendor-invoices", requireAuth, async (req, res): Promise<void> => {
  const vendorId = req.query.vendorId ? Number(req.query.vendorId) : NaN;
  const poId = req.query.purchaseOrderId ? Number(req.query.purchaseOrderId) : NaN;
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const filters: SQL[] = [];
  if (Number.isFinite(vendorId)) filters.push(eq(vendorInvoicesTable.vendorId, vendorId));
  if (Number.isFinite(poId)) filters.push(eq(vendorInvoicesTable.purchaseOrderId, poId));
  if (status) filters.push(eq(vendorInvoicesTable.status, status));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await selectVi().where(where).orderBy(desc(vendorInvoicesTable.invoiceDate), desc(vendorInvoicesTable.id))
    : await selectVi().orderBy(desc(vendorInvoicesTable.invoiceDate), desc(vendorInvoicesTable.id));
  res.json(rows.map(viDto));
});

router.post("/vendor-invoices", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVendorInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, d.vendorId));
  if (!vendor) { res.status(400).json({ error: "Vendor not found" }); return; }
  if (d.purchaseOrderId) {
    const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, d.purchaseOrderId));
    if (!po) { res.status(400).json({ error: "Purchase order not found" }); return; }
    if (po.vendorId !== d.vendorId) { res.status(400).json({ error: "PO vendor mismatch" }); return; }
  }
  const [row] = await db.insert(vendorInvoicesTable).values({
    vendorInvoiceNumber: d.vendorInvoiceNumber,
    purchaseOrderId: d.purchaseOrderId ?? null,
    vendorId: d.vendorId,
    amount: String(d.amount),
    invoiceDate: new Date(d.invoiceDate).toISOString().slice(0, 10),
    dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : null,
    notes: d.notes ?? null,
    recordedById: req.user?.id ?? null,
    status: "recorded",
  }).returning({ id: vendorInvoicesTable.id });
  const [out] = await selectVi().where(eq(vendorInvoicesTable.id, row.id));
  res.status(201).json(viDto(out));
});

export default router;

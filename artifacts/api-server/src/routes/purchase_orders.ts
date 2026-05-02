import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import {
  db, purchaseOrdersTable, poLineItemsTable, vendorsTable, projectsTable, usersTable,
  goodsReceiptsTable, grnLineItemsTable,
} from "@workspace/db";
import {
  CreatePurchaseOrderBody, UpdatePurchaseOrderBody, AddPoLineItemBody, RejectPurchaseOrderBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";

const router: IRouter = Router();
const SUPPLIER_STATE = (process.env.SUPPLIER_STATE ?? "Maharashtra").toLowerCase();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function determineSupplyType(state: string | null | undefined): "intra" | "inter" {
  if (!state) return "intra";
  return state.trim().toLowerCase() === SUPPLIER_STATE ? "intra" : "inter";
}

const poSelect = {
  id: purchaseOrdersTable.id,
  poNumber: purchaseOrdersTable.poNumber,
  vendorId: purchaseOrdersTable.vendorId,
  vendorName: vendorsTable.name,
  projectId: purchaseOrdersTable.projectId,
  projectName: projectsTable.name,
  title: purchaseOrdersTable.title,
  status: purchaseOrdersTable.status,
  orderDate: purchaseOrdersTable.orderDate,
  expectedDeliveryDate: purchaseOrdersTable.expectedDeliveryDate,
  supplyType: purchaseOrdersTable.supplyType,
  placeOfSupply: purchaseOrdersTable.placeOfSupply,
  subtotal: purchaseOrdersTable.subtotal,
  discountAmount: purchaseOrdersTable.discountAmount,
  taxableAmount: purchaseOrdersTable.taxableAmount,
  cgstAmount: purchaseOrdersTable.cgstAmount,
  sgstAmount: purchaseOrdersTable.sgstAmount,
  igstAmount: purchaseOrdersTable.igstAmount,
  total: purchaseOrdersTable.total,
  notes: purchaseOrdersTable.notes,
  termsAndConditions: purchaseOrdersTable.termsAndConditions,
  sentAt: purchaseOrdersTable.sentAt,
  approvedById: purchaseOrdersTable.approvedById,
  approvedByFirst: usersTable.firstName,
  approvedByLast: usersTable.lastName,
  approvedAt: purchaseOrdersTable.approvedAt,
  createdById: purchaseOrdersTable.createdById,
  createdAt: purchaseOrdersTable.createdAt,
  updatedAt: purchaseOrdersTable.updatedAt,
};

function selectPo() {
  return db.select(poSelect).from(purchaseOrdersTable)
    .leftJoin(vendorsTable, eq(vendorsTable.id, purchaseOrdersTable.vendorId))
    .leftJoin(projectsTable, eq(projectsTable.id, purchaseOrdersTable.projectId))
    .leftJoin(usersTable, eq(usersTable.id, purchaseOrdersTable.approvedById));
}

function poDto(p: Awaited<ReturnType<typeof selectPo>>[number]) {
  return {
    id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, vendorName: p.vendorName,
    projectId: p.projectId, projectName: p.projectName, title: p.title, status: p.status,
    orderDate: p.orderDate, expectedDeliveryDate: p.expectedDeliveryDate,
    supplyType: p.supplyType, placeOfSupply: p.placeOfSupply,
    subtotal: Number(p.subtotal), discountAmount: Number(p.discountAmount),
    taxableAmount: Number(p.taxableAmount), cgstAmount: Number(p.cgstAmount),
    sgstAmount: Number(p.sgstAmount), igstAmount: Number(p.igstAmount), total: Number(p.total),
    notes: p.notes, termsAndConditions: p.termsAndConditions,
    sentAt: p.sentAt ? p.sentAt.toISOString() : null,
    approvedById: p.approvedById,
    approvedByName: p.approvedByFirst ? `${p.approvedByFirst} ${p.approvedByLast ?? ""}`.trim() : null,
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    createdById: p.createdById, createdByName: null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

function lineDto(l: typeof poLineItemsTable.$inferSelect) {
  return {
    id: l.id, purchaseOrderId: l.purchaseOrderId,
    productName: l.productName, description: l.description, hsnCode: l.hsnCode,
    quantity: Number(l.quantity), receivedQuantity: Number(l.receivedQuantity),
    unit: l.unit, unitPrice: Number(l.unitPrice),
    discountPct: Number(l.discountPct), gstRate: Number(l.gstRate),
    lineTotal: Number(l.lineTotal),
  };
}

async function recomputePoTotals(poId: number) {
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, poId));
  if (!po) return;
  const items = await db.select().from(poLineItemsTable).where(eq(poLineItemsTable.purchaseOrderId, poId));
  let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
  const supply = po.supplyType;
  for (const it of items) {
    const qty = Number(it.quantity);
    const price = Number(it.unitPrice);
    const disc = Number(it.discountPct) / 100;
    const lineNet = +(qty * price * (1 - disc)).toFixed(2);
    subtotal += lineNet;
    const g = lineNet * (Number(it.gstRate) / 100);
    if (supply === "intra") { cgst += g / 2; sgst += g / 2; } else { igst += g; }
    await db.update(poLineItemsTable).set({ lineTotal: String(lineNet) }).where(eq(poLineItemsTable.id, it.id));
  }
  const discount = Number(po.discountAmount);
  const taxable = +(subtotal - discount).toFixed(2);
  cgst = +cgst.toFixed(2); sgst = +sgst.toFixed(2); igst = +igst.toFixed(2);
  const total = +(taxable + cgst + sgst + igst).toFixed(2);
  await db.update(purchaseOrdersTable).set({
    subtotal: String(subtotal), taxableAmount: String(taxable),
    cgstAmount: String(cgst), sgstAmount: String(sgst), igstAmount: String(igst),
    total: String(total), updatedAt: sql`now()`,
  }).where(eq(purchaseOrdersTable.id, poId));
}

async function poDetail(id: number) {
  const [head] = await selectPo().where(eq(purchaseOrdersTable.id, id));
  if (!head) return null;
  const lines = await db.select().from(poLineItemsTable).where(eq(poLineItemsTable.purchaseOrderId, id)).orderBy(poLineItemsTable.id);
  return { ...poDto(head), lineItems: lines.map(lineDto) };
}

router.get("/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const vendorId = req.query.vendorId ? Number(req.query.vendorId) : NaN;
  const projectId = req.query.projectId ? Number(req.query.projectId) : NaN;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters: SQL[] = [];
  if (status) filters.push(eq(purchaseOrdersTable.status, status));
  if (Number.isFinite(vendorId)) filters.push(eq(purchaseOrdersTable.vendorId, vendorId));
  if (Number.isFinite(projectId)) filters.push(eq(purchaseOrdersTable.projectId, projectId));
  if (search) {
    const o = or(ilike(purchaseOrdersTable.title, `%${search}%`), ilike(purchaseOrdersTable.poNumber, `%${search}%`));
    if (o) filters.push(o);
  }
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await selectPo().where(where).orderBy(desc(purchaseOrdersTable.orderDate), desc(purchaseOrdersTable.id))
    : await selectPo().orderBy(desc(purchaseOrdersTable.orderDate), desc(purchaseOrdersTable.id));
  res.json(rows.map(poDto));
});

router.post("/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePurchaseOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, d.vendorId));
  if (!vendor) { res.status(400).json({ error: "Vendor not found" }); return; }
  const placeOfSupply = d.placeOfSupply ?? vendor.state ?? "Maharashtra";
  const supplyType = determineSupplyType(placeOfSupply);
  const today = new Date().toISOString().slice(0, 10);
  const newId = await db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, "PO", purchaseOrdersTable, purchaseOrdersTable.poNumber);
    const [r] = await tx.insert(purchaseOrdersTable).values({
      poNumber: number,
      vendorId: d.vendorId,
      projectId: d.projectId ?? null,
      title: d.title,
      status: "draft",
      orderDate: d.orderDate ? new Date(d.orderDate).toISOString().slice(0, 10) : today,
      expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate).toISOString().slice(0, 10) : null,
      supplyType,
      placeOfSupply,
      notes: d.notes ?? null,
      termsAndConditions: d.termsAndConditions ?? null,
      createdById: req.user?.id ?? null,
    }).returning({ id: purchaseOrdersTable.id });
    return r.id;
  });
  const detail = await poDetail(newId);
  res.status(201).json(detail);
});

router.get("/purchase-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const detail = await poDetail(id);
  if (!detail) { res.status(404).json({ error: "Not found" }); return; }
  res.json(detail);
});

router.patch("/purchase-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePurchaseOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "draft") { res.status(409).json({ error: "Only draft purchase orders can be edited" }); return; }
  const d = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.title) patch.title = d.title;
  if (d.projectId !== undefined) patch.projectId = d.projectId;
  if (d.expectedDeliveryDate !== undefined) patch.expectedDeliveryDate = d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate).toISOString().slice(0, 10) : null;
  if (d.placeOfSupply) {
    patch.placeOfSupply = d.placeOfSupply;
    patch.supplyType = determineSupplyType(d.placeOfSupply);
  }
  if (d.notes !== undefined) patch.notes = d.notes;
  if (d.termsAndConditions !== undefined) patch.termsAndConditions = d.termsAndConditions;
  await db.update(purchaseOrdersTable).set(patch).where(eq(purchaseOrdersTable.id, id));
  if (d.placeOfSupply) await recomputePoTotals(id);
  const detail = await poDetail(id);
  res.json(detail);
});

router.post("/purchase-orders/:id/line-items", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AddPoLineItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "draft") { res.status(409).json({ error: "Only draft purchase orders can be edited" }); return; }
  const d = parsed.data;
  const [row] = await db.insert(poLineItemsTable).values({
    purchaseOrderId: id,
    productName: d.productName,
    description: d.description ?? null,
    hsnCode: d.hsnCode ?? null,
    quantity: String(d.quantity),
    unit: d.unit ?? "nos",
    unitPrice: String(d.unitPrice),
    discountPct: String(d.discountPct ?? 0),
    gstRate: String(d.gstRate),
  }).returning();
  await recomputePoTotals(id);
  res.status(201).json(lineDto(row));
});

router.delete("/purchase-orders/:id/line-items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (id == null || itemId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "draft") { res.status(409).json({ error: "Only draft purchase orders can be edited" }); return; }
  await db.delete(poLineItemsTable).where(and(eq(poLineItemsTable.id, itemId), eq(poLineItemsTable.purchaseOrderId, id))!);
  await recomputePoTotals(id);
  res.status(204).end();
});

router.post("/purchase-orders/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "draft") { res.status(409).json({ error: "Only draft POs can be submitted" }); return; }
  const items = await db.select({ id: poLineItemsTable.id }).from(poLineItemsTable).where(eq(poLineItemsTable.purchaseOrderId, id));
  if (items.length === 0) { res.status(400).json({ error: "PO must have at least one line item" }); return; }
  await db.update(purchaseOrdersTable).set({ status: "pending_approval", updatedAt: sql`now()` }).where(eq(purchaseOrdersTable.id, id));
  res.json(await poDetail(id));
});

router.post("/purchase-orders/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "pending_approval") { res.status(409).json({ error: "Only POs pending approval can be approved" }); return; }
  await db.update(purchaseOrdersTable).set({
    status: "approved",
    approvedById: req.user?.id ?? null,
    approvedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrdersTable.id, id));
  res.json(await poDetail(id));
});

router.post("/purchase-orders/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RejectPurchaseOrderBody.safeParse(req.body ?? {});
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "pending_approval") { res.status(409).json({ error: "Only POs pending approval can be rejected" }); return; }
  await db.update(purchaseOrdersTable).set({
    status: "draft",
    notes: reason ? `[Rejected] ${reason}\n${po.notes ?? ""}`.trim() : po.notes,
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrdersTable.id, id));
  res.json(await poDetail(id));
});

router.post("/purchase-orders/:id/send", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status !== "approved") { res.status(409).json({ error: "Only approved POs can be sent to vendor" }); return; }
  await db.update(purchaseOrdersTable).set({ status: "sent", sentAt: sql`now()`, updatedAt: sql`now()` }).where(eq(purchaseOrdersTable.id, id));
  res.json(await poDetail(id));
});

router.post("/purchase-orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (po.status === "received" || po.status === "closed") { res.status(409).json({ error: "Cannot cancel a closed PO" }); return; }
  await db.update(purchaseOrdersTable).set({ status: "cancelled", updatedAt: sql`now()` }).where(eq(purchaseOrdersTable.id, id));
  res.json(await poDetail(id));
});

export { recomputePoTotals };
export default router;

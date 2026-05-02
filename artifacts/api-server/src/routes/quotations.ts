import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import {
  db, quotationsTable, quotationLineItemsTable,
  accountsTable, usersTable, leadsTable, approvalRequestsTable,
  salesOrdersTable,
} from "@workspace/db";
import {
  CreateQuotationBody, UpdateQuotationBody,
  AddQuotationLineItemBody, UpdateQuotationLineItemBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { evaluateAndCreateApprovalRequests } from "./approvals";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const qSelect = {
  id: quotationsTable.id,
  quotationNumber: quotationsTable.quotationNumber,
  leadId: quotationsTable.leadId,
  leadTitle: leadsTable.title,
  accountId: quotationsTable.accountId,
  accountName: accountsTable.name,
  contactId: quotationsTable.contactId,
  title: quotationsTable.title,
  status: quotationsTable.status,
  validUntil: quotationsTable.validUntil,
  subtotal: quotationsTable.subtotal,
  discountAmount: quotationsTable.discountAmount,
  taxableAmount: quotationsTable.taxableAmount,
  gstAmount: quotationsTable.gstAmount,
  total: quotationsTable.total,
  notes: quotationsTable.notes,
  termsAndConditions: quotationsTable.termsAndConditions,
  createdById: quotationsTable.createdById,
  createdByFirst: usersTable.firstName,
  createdByLast: usersTable.lastName,
  createdAt: quotationsTable.createdAt,
  updatedAt: quotationsTable.updatedAt,
};

type QRow = Awaited<ReturnType<typeof selectQuotation>>[number];
function selectQuotation() {
  return db.select(qSelect).from(quotationsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, quotationsTable.accountId))
    .leftJoin(leadsTable, eq(leadsTable.id, quotationsTable.leadId))
    .leftJoin(usersTable, eq(usersTable.id, quotationsTable.createdById));
}

function qDto(q: QRow) {
  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    leadId: q.leadId,
    leadTitle: q.leadTitle,
    accountId: q.accountId,
    accountName: q.accountName,
    contactId: q.contactId,
    title: q.title,
    status: q.status,
    validUntil: q.validUntil,
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    taxableAmount: Number(q.taxableAmount),
    gstAmount: Number(q.gstAmount),
    total: Number(q.total),
    notes: q.notes,
    termsAndConditions: q.termsAndConditions,
    createdById: q.createdById,
    createdByName: q.createdByFirst ? `${q.createdByFirst} ${q.createdByLast ?? ""}`.trim() : null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function lineItemDto(l: typeof quotationLineItemsTable.$inferSelect) {
  return {
    id: l.id, quotationId: l.quotationId,
    productId: l.productId,
    productName: l.productName,
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit,
    unitPrice: Number(l.unitPrice),
    discountPct: Number(l.discountPct),
    gstRate: Number(l.gstRate),
    lineTotal: Number(l.lineTotal),
    position: l.position,
  };
}

function calcLineTotal(qty: number, price: number, discountPct: number) {
  const gross = qty * price;
  const net = gross - (gross * discountPct / 100);
  return +net.toFixed(2);
}

async function recalcQuotation(quotationId: number) {
  const items = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, quotationId));
  let subtotal = 0;
  let gstTotal = 0;
  for (const it of items) {
    const lineNet = Number(it.lineTotal);
    subtotal += lineNet;
    gstTotal += lineNet * (Number(it.gstRate) / 100);
  }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, quotationId));
  const discountAmt = Number(q?.discountAmount ?? 0);
  const taxable = Math.max(0, subtotal - discountAmt);
  const gst = +(taxable * (subtotal > 0 ? (gstTotal / subtotal) : 0)).toFixed(2);
  const total = +(taxable + gst).toFixed(2);
  await db.update(quotationsTable).set({
    subtotal: String(+subtotal.toFixed(2)),
    taxableAmount: String(+taxable.toFixed(2)),
    gstAmount: String(gst),
    total: String(total),
    updatedAt: sql`now()`,
  }).where(eq(quotationsTable.id, quotationId));
  return total;
}

async function nextQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: quotationsTable.id }).from(quotationsTable);
  const seq = rows.length + 1;
  return `QT-${year}-${String(seq).padStart(5, "0")}`;
}

router.get("/quotations", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const leadId = req.query.leadId ? Number(req.query.leadId) : NaN;
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters: SQL[] = [];
  if (status) filters.push(eq(quotationsTable.status, status));
  if (Number.isFinite(leadId)) filters.push(eq(quotationsTable.leadId, leadId));
  if (Number.isFinite(accountId)) filters.push(eq(quotationsTable.accountId, accountId));
  if (search) {
    const orClause = or(
      ilike(quotationsTable.title, `%${search}%`),
      ilike(quotationsTable.quotationNumber, `%${search}%`),
    );
    if (orClause) filters.push(orClause);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectQuotation();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(quotationsTable.updatedAt))
    : await baseQuery.orderBy(desc(quotationsTable.updatedAt));
  res.json(rows.map(qDto));
});

router.post("/quotations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const number = await nextQuotationNumber();
  const [row] = await db.insert(quotationsTable).values({
    quotationNumber: number,
    leadId: d.leadId ?? null,
    accountId: d.accountId ?? null,
    contactId: d.contactId ?? null,
    title: d.title,
    status: "draft",
    validUntil: d.validUntil ? new Date(d.validUntil).toISOString().slice(0, 10) : null,
    discountAmount: String(d.discountAmount ?? 0),
    notes: d.notes ?? null,
    termsAndConditions: d.termsAndConditions ?? null,
    createdById: req.user?.id ?? null,
  }).returning({ id: quotationsTable.id });
  const [out] = await selectQuotation().where(eq(quotationsTable.id, row.id));
  res.status(201).json(qDto(out));
});

router.get("/quotations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectQuotation().where(eq(quotationsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(quotationLineItemsTable)
    .where(eq(quotationLineItemsTable.quotationId, id))
    .orderBy(quotationLineItemsTable.position);
  const approvals = await db.select().from(approvalRequestsTable).where(
    and(eq(approvalRequestsTable.entityType, "quotation"), eq(approvalRequestsTable.entityId, id))!,
  ).orderBy(approvalRequestsTable.level);
  res.json({
    ...qDto(row),
    lineItems: items.map(lineItemDto),
    approvalRequests: approvals.map(a => ({
      id: a.id, entityType: a.entityType, entityId: a.entityId,
      amount: Number(a.amount), ruleId: a.ruleId,
      approverRole: a.approverRole, approverId: a.approverId,
      level: a.level, status: a.status, comments: a.comments,
      actionedAt: a.actionedAt ? a.actionedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.patch("/quotations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  await db.update(quotationsTable).set({
    leadId: d.leadId ?? null,
    accountId: d.accountId ?? null,
    contactId: d.contactId ?? null,
    title: d.title,
    validUntil: d.validUntil ? new Date(d.validUntil).toISOString().slice(0, 10) : null,
    discountAmount: String(d.discountAmount ?? 0),
    notes: d.notes ?? null,
    termsAndConditions: d.termsAndConditions ?? null,
    updatedAt: sql`now()`,
  }).where(eq(quotationsTable.id, id));
  await recalcQuotation(id);
  const [out] = await selectQuotation().where(eq(quotationsTable.id, id));
  res.json(qDto(out));
});

router.delete("/quotations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.status(204).end();
});

router.post("/quotations/:id/line-items", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AddQuotationLineItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const lineTotal = calcLineTotal(d.quantity, d.unitPrice, d.discountPct ?? 0);
  const [row] = await db.insert(quotationLineItemsTable).values({
    quotationId: id,
    productId: d.productId ?? null,
    productName: d.productName,
    description: d.description ?? null,
    quantity: String(d.quantity),
    unit: d.unit,
    unitPrice: String(d.unitPrice),
    discountPct: String(d.discountPct ?? 0),
    gstRate: String(d.gstRate),
    lineTotal: String(lineTotal),
    position: d.position ?? 0,
  }).returning();
  await recalcQuotation(id);
  res.status(201).json(lineItemDto(row));
});

router.patch("/quotations/:id/line-items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (id == null || itemId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateQuotationLineItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const lineTotal = calcLineTotal(d.quantity, d.unitPrice, d.discountPct ?? 0);
  await db.update(quotationLineItemsTable).set({
    productId: d.productId ?? null,
    productName: d.productName,
    description: d.description ?? null,
    quantity: String(d.quantity),
    unit: d.unit,
    unitPrice: String(d.unitPrice),
    discountPct: String(d.discountPct ?? 0),
    gstRate: String(d.gstRate),
    lineTotal: String(lineTotal),
    position: d.position ?? 0,
  }).where(and(eq(quotationLineItemsTable.id, itemId), eq(quotationLineItemsTable.quotationId, id))!);
  await recalcQuotation(id);
  const [row] = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.id, itemId));
  res.json(lineItemDto(row));
});

router.delete("/quotations/:id/line-items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (id == null || itemId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(quotationLineItemsTable).where(and(eq(quotationLineItemsTable.id, itemId), eq(quotationLineItemsTable.quotationId, id))!);
  await recalcQuotation(id);
  res.status(204).end();
});

router.post("/quotations/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status !== "draft" && q.status !== "rejected") { res.status(400).json({ error: `Cannot submit from status: ${q.status}` }); return; }
  const total = await recalcQuotation(id);
  // Clear any prior approval requests for this quotation
  await db.delete(approvalRequestsTable).where(
    and(eq(approvalRequestsTable.entityType, "quotation"), eq(approvalRequestsTable.entityId, id))!,
  );
  const created = await evaluateAndCreateApprovalRequests({ entityType: "quotation", entityId: id, amount: total });
  // If no rules apply, auto-approve
  const newStatus = created === 0 ? "approved" : "pending_approval";
  await db.update(quotationsTable).set({ status: newStatus, updatedAt: sql`now()` }).where(eq(quotationsTable.id, id));
  const [out] = await selectQuotation().where(eq(quotationsTable.id, id));
  res.json(qDto(out));
});

router.post("/quotations/:id/send", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status !== "approved") { res.status(400).json({ error: "Quotation must be approved before sending" }); return; }
  await db.update(quotationsTable).set({ status: "sent", updatedAt: sql`now()` }).where(eq(quotationsTable.id, id));
  const [out] = await selectQuotation().where(eq(quotationsTable.id, id));
  res.json(qDto(out));
});

router.post("/quotations/:id/mark-won", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status !== "approved" && q.status !== "sent") { res.status(400).json({ error: `Cannot mark won from status: ${q.status}` }); return; }
  await db.update(quotationsTable).set({ status: "won", updatedAt: sql`now()` }).where(eq(quotationsTable.id, id));
  const [out] = await selectQuotation().where(eq(quotationsTable.id, id));
  res.json(qDto(out));
});

router.post("/quotations/:id/mark-lost", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status === "won" || q.status === "lost") { res.status(400).json({ error: `Cannot mark lost from status: ${q.status}` }); return; }
  await db.update(quotationsTable).set({ status: "lost", updatedAt: sql`now()` }).where(eq(quotationsTable.id, id));
  const [out] = await selectQuotation().where(eq(quotationsTable.id, id));
  res.json(qDto(out));
});

router.post("/quotations/:id/convert-to-order", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (q.status !== "approved" && q.status !== "sent" && q.status !== "won") {
    res.status(400).json({ error: "Quotation must be approved before conversion" }); return;
  }
  const year = new Date().getFullYear();
  const rows = await db.select({ id: salesOrdersTable.id }).from(salesOrdersTable);
  const orderNumber = `SO-${year}-${String(rows.length + 1).padStart(5, "0")}`;
  const [order] = await db.insert(salesOrdersTable).values({
    orderNumber,
    quotationId: id,
    accountId: q.accountId,
    title: q.title,
    status: "confirmed",
    total: q.total,
    orderDate: new Date().toISOString().slice(0, 10),
  }).returning();
  if (q.status !== "won") {
    await db.update(quotationsTable).set({ status: "won", updatedAt: sql`now()` }).where(eq(quotationsTable.id, id));
  }
  res.status(201).json({
    id: order.id,
    orderNumber: order.orderNumber,
    quotationId: order.quotationId,
    accountId: order.accountId,
    accountName: null,
    title: order.title,
    status: order.status,
    total: Number(order.total),
    orderDate: order.orderDate,
    expectedDeliveryDate: order.expectedDeliveryDate,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
});

export default router;

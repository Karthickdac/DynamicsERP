import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import {
  db, invoicesTable, invoiceLineItemsTable, paymentsTable, creditNotesTable,
  accountsTable, usersTable, salesOrdersTable, projectsTable,
  quotationLineItemsTable,
} from "@workspace/db";
import {
  CreateInvoiceBody, UpdateInvoiceBody,
  AddInvoiceLineItemBody, UpdateInvoiceLineItemBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();
const SUPPLIER_STATE = (process.env.SUPPLIER_STATE ?? "Maharashtra").toLowerCase();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function determineSupplyType(placeOfSupply: string | null | undefined): "intra" | "inter" {
  if (!placeOfSupply) return "intra";
  return placeOfSupply.trim().toLowerCase() === SUPPLIER_STATE ? "intra" : "inter";
}

const iSelect = {
  id: invoicesTable.id,
  invoiceNumber: invoicesTable.invoiceNumber,
  invoiceType: invoicesTable.invoiceType,
  salesOrderId: invoicesTable.salesOrderId,
  salesOrderNumber: salesOrdersTable.orderNumber,
  projectId: invoicesTable.projectId,
  projectName: projectsTable.name,
  accountId: invoicesTable.accountId,
  accountName: accountsTable.name,
  title: invoicesTable.title,
  status: invoicesTable.status,
  invoiceDate: invoicesTable.invoiceDate,
  dueDate: invoicesTable.dueDate,
  supplyType: invoicesTable.supplyType,
  placeOfSupply: invoicesTable.placeOfSupply,
  buyerGstin: invoicesTable.buyerGstin,
  subtotal: invoicesTable.subtotal,
  discountAmount: invoicesTable.discountAmount,
  taxableAmount: invoicesTable.taxableAmount,
  cgstAmount: invoicesTable.cgstAmount,
  sgstAmount: invoicesTable.sgstAmount,
  igstAmount: invoicesTable.igstAmount,
  total: invoicesTable.total,
  paidAmount: invoicesTable.paidAmount,
  notes: invoicesTable.notes,
  termsAndConditions: invoicesTable.termsAndConditions,
  createdById: invoicesTable.createdById,
  createdByFirst: usersTable.firstName,
  createdByLast: usersTable.lastName,
  createdAt: invoicesTable.createdAt,
  updatedAt: invoicesTable.updatedAt,
};

type IRow = Awaited<ReturnType<typeof selectInvoice>>[number];
function selectInvoice() {
  return db.select(iSelect).from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.accountId))
    .leftJoin(salesOrdersTable, eq(salesOrdersTable.id, invoicesTable.salesOrderId))
    .leftJoin(projectsTable, eq(projectsTable.id, invoicesTable.projectId))
    .leftJoin(usersTable, eq(usersTable.id, invoicesTable.createdById));
}

function isOverdue(status: string, dueDate: string | null): boolean {
  if (!dueDate) return false;
  if (status !== "sent" && status !== "partially_paid") return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function invoiceDto(i: IRow) {
  const total = Number(i.total);
  const paid = Number(i.paidAmount);
  const balance = +(total - paid).toFixed(2);
  const effectiveStatus = isOverdue(i.status, i.dueDate) ? "overdue" : i.status;
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    invoiceType: i.invoiceType,
    salesOrderId: i.salesOrderId,
    salesOrderNumber: i.salesOrderNumber,
    projectId: i.projectId,
    projectName: i.projectName,
    accountId: i.accountId,
    accountName: i.accountName,
    title: i.title,
    status: effectiveStatus,
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate,
    supplyType: i.supplyType,
    placeOfSupply: i.placeOfSupply,
    buyerGstin: i.buyerGstin,
    subtotal: Number(i.subtotal),
    discountAmount: Number(i.discountAmount),
    taxableAmount: Number(i.taxableAmount),
    cgstAmount: Number(i.cgstAmount),
    sgstAmount: Number(i.sgstAmount),
    igstAmount: Number(i.igstAmount),
    total,
    paidAmount: paid,
    balanceDue: balance,
    notes: i.notes,
    termsAndConditions: i.termsAndConditions,
    createdById: i.createdById,
    createdByName: i.createdByFirst ? `${i.createdByFirst} ${i.createdByLast ?? ""}`.trim() : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function lineItemDto(l: typeof invoiceLineItemsTable.$inferSelect) {
  return {
    id: l.id, invoiceId: l.invoiceId,
    productId: l.productId, productName: l.productName,
    description: l.description, hsnCode: l.hsnCode,
    quantity: Number(l.quantity), unit: l.unit,
    unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct),
    gstRate: Number(l.gstRate), lineTotal: Number(l.lineTotal),
    position: l.position,
  };
}

function calcLineTotal(qty: number, price: number, discountPct: number) {
  const gross = qty * price;
  const net = gross - (gross * discountPct / 100);
  return +net.toFixed(2);
}

async function recalcInvoice(invoiceId: number) {
  const items = await db.select().from(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoiceId, invoiceId));
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv) return;
  let subtotal = 0;
  let weightedGst = 0;
  for (const it of items) {
    const lineNet = Number(it.lineTotal);
    subtotal += lineNet;
    weightedGst += lineNet * (Number(it.gstRate) / 100);
  }
  const discountAmt = Number(inv.discountAmount);
  const taxable = Math.max(0, +(subtotal - discountAmt).toFixed(2));
  const ratio = subtotal > 0 ? taxable / subtotal : 0;
  const gst = +(weightedGst * ratio).toFixed(2);
  let cgst = 0, sgst = 0, igst = 0;
  if (inv.supplyType === "intra") {
    cgst = +(gst / 2).toFixed(2);
    sgst = +(gst - cgst).toFixed(2);
  } else {
    igst = gst;
  }
  const total = +(taxable + gst).toFixed(2);
  await db.update(invoicesTable).set({
    subtotal: String(+subtotal.toFixed(2)),
    taxableAmount: String(taxable),
    cgstAmount: String(cgst),
    sgstAmount: String(sgst),
    igstAmount: String(igst),
    total: String(total),
    updatedAt: sql`now()`,
  }).where(eq(invoicesTable.id, invoiceId));
  return total;
}


router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const invoiceType = typeof req.query.invoiceType === "string" ? req.query.invoiceType : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters: SQL[] = [];
  if (status && status !== "overdue") filters.push(eq(invoicesTable.status, status));
  if (Number.isFinite(accountId)) filters.push(eq(invoicesTable.accountId, accountId));
  if (invoiceType) filters.push(eq(invoicesTable.invoiceType, invoiceType));
  if (search) {
    const or1 = or(ilike(invoicesTable.title, `%${search}%`), ilike(invoicesTable.invoiceNumber, `%${search}%`));
    if (or1) filters.push(or1);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectInvoice();
  let rows = where
    ? await baseQuery.where(where).orderBy(desc(invoicesTable.invoiceDate), desc(invoicesTable.id))
    : await baseQuery.orderBy(desc(invoicesTable.invoiceDate), desc(invoicesTable.id));
  let dtos = rows.map(invoiceDto);
  if (status === "overdue") dtos = dtos.filter(d => d.status === "overdue");
  res.json(dtos);
});

router.post("/invoices", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, d.accountId));
  if (!acc) { res.status(400).json({ error: "Account not found" }); return; }
  const placeOfSupply = d.placeOfSupply ?? acc.billingState ?? "Maharashtra";
  const supplyType = determineSupplyType(placeOfSupply);
  const today = new Date().toISOString().slice(0, 10);
  const newId = await db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, "INV", invoicesTable, invoicesTable.invoiceNumber);
    const [row] = await tx.insert(invoicesTable).values({
      invoiceNumber: number,
      invoiceType: d.invoiceType ?? "tax",
      salesOrderId: d.salesOrderId ?? null,
      projectId: d.projectId ?? null,
      accountId: d.accountId,
      title: d.title,
      status: "draft",
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate).toISOString().slice(0, 10) : today,
      dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : null,
      supplyType,
      placeOfSupply,
      buyerGstin: acc.gstin ?? null,
      discountAmount: String(d.discountAmount ?? 0),
      notes: d.notes ?? null,
      termsAndConditions: d.termsAndConditions ?? null,
      createdById: req.user?.id ?? null,
    }).returning({ id: invoicesTable.id });
    return row.id;
  });
  const [out] = await selectInvoice().where(eq(invoicesTable.id, newId));
  res.status(201).json({ ...invoiceDto(out), lineItems: [], payments: [], creditNotes: [] });
});

router.post("/invoices/from-sales-order/:salesOrderId", requireAuth, async (req, res): Promise<void> => {
  const soId = parseId(req.params.salesOrderId);
  if (soId == null) { res.status(400).json({ error: "Invalid sales order id" }); return; }
  const [so] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, soId));
  if (!so) { res.status(404).json({ error: "Sales order not found" }); return; }
  if (so.accountId == null) { res.status(400).json({ error: "Sales order has no account" }); return; }
  const accountId: number = so.accountId;
  const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!acc) { res.status(400).json({ error: "Account not found" }); return; }
  const placeOfSupply = acc.billingState ?? "Maharashtra";
  const supplyType = determineSupplyType(placeOfSupply);
  const today = new Date().toISOString().slice(0, 10);
  const newInvId = await db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, "INV", invoicesTable, invoicesTable.invoiceNumber);
    const [r] = await tx.insert(invoicesTable).values({
      invoiceNumber: number,
      invoiceType: "tax",
      salesOrderId: so.id,
      accountId,
      title: so.title,
      status: "draft",
      invoiceDate: today,
      dueDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
      supplyType,
      placeOfSupply,
      buyerGstin: acc.gstin ?? null,
      createdById: req.user?.id ?? null,
    }).returning({ id: invoicesTable.id });
    return r.id;
  });
  const row = { id: newInvId };
  // Copy line items from quotation
  if (so.quotationId) {
    const items = await db.select().from(quotationLineItemsTable)
      .where(eq(quotationLineItemsTable.quotationId, so.quotationId))
      .orderBy(quotationLineItemsTable.position);
    for (const it of items) {
      await db.insert(invoiceLineItemsTable).values({
        invoiceId: row.id,
        productId: it.productId,
        productName: it.productName,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        gstRate: it.gstRate,
        lineTotal: it.lineTotal,
        position: it.position,
      });
    }
  }
  await recalcInvoice(row.id);
  const [out] = await selectInvoice().where(eq(invoicesTable.id, row.id));
  const items = await db.select().from(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoiceId, row.id)).orderBy(invoiceLineItemsTable.position);
  res.status(201).json({ ...invoiceDto(out), lineItems: items.map(lineItemDto), payments: [], creditNotes: [] });
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectInvoice().where(eq(invoicesTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(invoiceLineItemsTable)
    .where(eq(invoiceLineItemsTable.invoiceId, id))
    .orderBy(invoiceLineItemsTable.position);
  const pays = await db.select({
    id: paymentsTable.id, paymentNumber: paymentsTable.paymentNumber,
    invoiceId: paymentsTable.invoiceId, accountId: paymentsTable.accountId,
    amount: paymentsTable.amount, paymentDate: paymentsTable.paymentDate,
    paymentMode: paymentsTable.paymentMode, referenceNumber: paymentsTable.referenceNumber,
    notes: paymentsTable.notes, recordedById: paymentsTable.recordedById,
    createdAt: paymentsTable.createdAt,
    invoiceNumber: invoicesTable.invoiceNumber, accountName: accountsTable.name,
    rFirst: usersTable.firstName, rLast: usersTable.lastName,
  }).from(paymentsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId))
    .leftJoin(accountsTable, eq(accountsTable.id, paymentsTable.accountId))
    .leftJoin(usersTable, eq(usersTable.id, paymentsTable.recordedById))
    .where(eq(paymentsTable.invoiceId, id))
    .orderBy(desc(paymentsTable.paymentDate));
  const cns = await db.select({
    id: creditNotesTable.id, creditNoteNumber: creditNotesTable.creditNoteNumber,
    invoiceId: creditNotesTable.invoiceId, accountId: creditNotesTable.accountId,
    amount: creditNotesTable.amount, reason: creditNotesTable.reason,
    status: creditNotesTable.status, issueDate: creditNotesTable.issueDate,
    notes: creditNotesTable.notes, createdById: creditNotesTable.createdById,
    createdAt: creditNotesTable.createdAt,
    invoiceNumber: invoicesTable.invoiceNumber, accountName: accountsTable.name,
  }).from(creditNotesTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, creditNotesTable.invoiceId))
    .leftJoin(accountsTable, eq(accountsTable.id, creditNotesTable.accountId))
    .where(eq(creditNotesTable.invoiceId, id))
    .orderBy(desc(creditNotesTable.issueDate));
  res.json({
    ...invoiceDto(row),
    lineItems: items.map(lineItemDto),
    payments: pays.map(p => ({
      id: p.id, paymentNumber: p.paymentNumber, invoiceId: p.invoiceId,
      invoiceNumber: p.invoiceNumber, accountId: p.accountId, accountName: p.accountName,
      amount: Number(p.amount), paymentDate: p.paymentDate, paymentMode: p.paymentMode,
      referenceNumber: p.referenceNumber, notes: p.notes,
      recordedById: p.recordedById, recordedByName: p.rFirst ? `${p.rFirst} ${p.rLast ?? ""}`.trim() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    creditNotes: cns.map(c => ({
      id: c.id, creditNoteNumber: c.creditNoteNumber, invoiceId: c.invoiceId,
      invoiceNumber: c.invoiceNumber, accountId: c.accountId, accountName: c.accountName,
      amount: Number(c.amount), reason: c.reason, status: c.status, issueDate: c.issueDate,
      notes: c.notes, createdById: c.createdById, createdAt: c.createdAt.toISOString(),
    })),
  });
});

router.patch("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "draft") {
    res.status(409).json({ error: "Only draft invoices can be edited" }); return;
  }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.title !== undefined) update.title = d.title;
  if (d.invoiceDate !== undefined) update.invoiceDate = new Date(d.invoiceDate).toISOString().slice(0, 10);
  if (d.dueDate !== undefined) update.dueDate = d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : null;
  if (d.placeOfSupply !== undefined) {
    update.placeOfSupply = d.placeOfSupply;
    update.supplyType = determineSupplyType(d.placeOfSupply);
  }
  if (d.discountAmount !== undefined) update.discountAmount = String(d.discountAmount);
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  if (d.termsAndConditions !== undefined) update.termsAndConditions = d.termsAndConditions ?? null;
  await db.update(invoicesTable).set(update).where(eq(invoicesTable.id, id));
  await recalcInvoice(id);
  const [out] = await selectInvoice().where(eq(invoicesTable.id, id));
  res.json(invoiceDto(out));
});

router.delete("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status !== "draft" && inv.status !== "cancelled") {
    res.status(409).json({ error: "Only draft or cancelled invoices can be deleted" }); return;
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.status(204).end();
});

router.post("/invoices/:id/line-items", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AddInvoiceLineItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: "Only draft invoices can be edited" }); return; }
  const d = parsed.data;
  const lineTotal = calcLineTotal(d.quantity, d.unitPrice, d.discountPct ?? 0);
  const [row] = await db.insert(invoiceLineItemsTable).values({
    invoiceId: id,
    productId: d.productId ?? null,
    productName: d.productName,
    description: d.description ?? null,
    hsnCode: d.hsnCode ?? null,
    quantity: String(d.quantity),
    unit: d.unit ?? "nos",
    unitPrice: String(d.unitPrice),
    discountPct: String(d.discountPct ?? 0),
    gstRate: String(d.gstRate),
    lineTotal: String(lineTotal),
    position: d.position ?? 0,
  }).returning();
  await recalcInvoice(id);
  res.status(201).json(lineItemDto(row));
});

router.patch("/invoices/:id/line-items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (id == null || itemId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateInvoiceLineItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: "Only draft invoices can be edited" }); return; }
  const d = parsed.data;
  const lineTotal = calcLineTotal(d.quantity, d.unitPrice, d.discountPct);
  await db.update(invoiceLineItemsTable).set({
    productId: d.productId ?? null,
    productName: d.productName,
    description: d.description ?? null,
    hsnCode: d.hsnCode ?? null,
    quantity: String(d.quantity),
    unit: d.unit,
    unitPrice: String(d.unitPrice),
    discountPct: String(d.discountPct),
    gstRate: String(d.gstRate),
    lineTotal: String(lineTotal),
    position: d.position,
  }).where(and(eq(invoiceLineItemsTable.id, itemId), eq(invoiceLineItemsTable.invoiceId, id))!);
  await recalcInvoice(id);
  const [row] = await db.select().from(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.id, itemId));
  res.json(lineItemDto(row));
});

router.delete("/invoices/:id/line-items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (id == null || itemId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: "Only draft invoices can be edited" }); return; }
  await db.delete(invoiceLineItemsTable).where(and(eq(invoiceLineItemsTable.id, itemId), eq(invoiceLineItemsTable.invoiceId, id))!);
  await recalcInvoice(id);
  res.status(204).end();
});

router.post("/invoices/:id/send", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: `Cannot send from status: ${inv.status}` }); return; }
  if (Number(inv.total) <= 0) { res.status(400).json({ error: "Invoice total must be > 0" }); return; }
  await db.update(invoicesTable).set({ status: "sent", updatedAt: sql`now()` }).where(eq(invoicesTable.id, id));
  const [out] = await selectInvoice().where(eq(invoicesTable.id, id));
  if (inv.createdById) {
    dispatchSafe({
      userIds: [inv.createdById], eventKey: "invoice.sent",
      title: `Invoice sent: ${inv.invoiceNumber}`,
      body: `Total: ₹${Number(inv.total).toFixed(2)}`,
      link: `/invoices/${id}`, entityType: "invoice", entityId: id,
    });
  }
  res.json(invoiceDto(out));
});

router.post("/invoices/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.status === "paid") { res.status(409).json({ error: "Cannot cancel a fully paid invoice" }); return; }
  await db.update(invoicesTable).set({ status: "cancelled", updatedAt: sql`now()` }).where(eq(invoicesTable.id, id));
  const [out] = await selectInvoice().where(eq(invoicesTable.id, id));
  res.json(invoiceDto(out));
});

export default router;

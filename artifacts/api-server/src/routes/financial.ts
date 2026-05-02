import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import {
  db, invoicesTable, paymentsTable, accountsTable, invoiceLineItemsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/financial/summary", requireAuth, async (_req, res): Promise<void> => {
  const invs = await db.select().from(invoicesTable);
  const today = new Date().toISOString().slice(0, 10);
  let totalInvoiced = 0, totalCollected = 0, totalOutstanding = 0, totalOverdue = 0;
  let countDraft = 0, countSent = 0, countPP = 0, countPaid = 0, countOverdue = 0;
  const months = new Map<string, { invoiced: number; collected: number }>();
  for (const i of invs) {
    if (i.status === "cancelled" || i.invoiceType === "proforma") continue;
    const total = Number(i.total);
    const paid = Number(i.paidAmount);
    totalInvoiced += total;
    totalCollected += paid;
    const balance = +(total - paid).toFixed(2);
    const overdue = i.dueDate && (i.status === "sent" || i.status === "partially_paid") && i.dueDate < today;
    if (i.status !== "paid") totalOutstanding += balance;
    if (overdue) { totalOverdue += balance; countOverdue++; }
    if (i.status === "draft") countDraft++;
    else if (i.status === "sent") countSent++;
    else if (i.status === "partially_paid") countPP++;
    else if (i.status === "paid") countPaid++;
    const month = i.invoiceDate.slice(0, 7);
    const m = months.get(month) ?? { invoiced: 0, collected: 0 };
    m.invoiced += total;
    months.set(month, m);
  }
  // Payments → collected per month, excluding payments tied to cancelled or proforma invoices
  const pays = await db.select({
    amount: paymentsTable.amount,
    paymentDate: paymentsTable.paymentDate,
    invStatus: invoicesTable.status,
    invType: invoicesTable.invoiceType,
  }).from(paymentsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId));
  for (const p of pays) {
    if (p.invStatus === "cancelled" || p.invType === "proforma") continue;
    const month = p.paymentDate.slice(0, 7);
    const m = months.get(month) ?? { invoiced: 0, collected: 0 };
    m.collected += Number(p.amount);
    months.set(month, m);
  }
  const monthlyTrend = Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, v]) => ({ month, invoiced: +v.invoiced.toFixed(2), collected: +v.collected.toFixed(2) }));
  res.json({
    totalInvoiced: +totalInvoiced.toFixed(2),
    totalCollected: +totalCollected.toFixed(2),
    totalOutstanding: +totalOutstanding.toFixed(2),
    totalOverdue: +totalOverdue.toFixed(2),
    countDraft, countSent, countPartiallyPaid: countPP, countPaid, countOverdue,
    monthlyTrend,
  });
});

router.get("/financial/ageing", requireAuth, async (_req, res): Promise<void> => {
  const invs = await db.select({
    id: invoicesTable.id, accountId: invoicesTable.accountId,
    accountName: accountsTable.name, total: invoicesTable.total,
    paidAmount: invoicesTable.paidAmount, dueDate: invoicesTable.dueDate,
    status: invoicesTable.status, invoiceType: invoicesTable.invoiceType,
  }).from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.accountId));
  const today = new Date();
  const rowsByAccount = new Map<number, { accountId: number; accountName: string; bucket0to30: number; bucket31to60: number; bucket61to90: number; bucket90Plus: number; total: number; }>();
  for (const i of invs) {
    if (i.status === "paid" || i.status === "cancelled" || i.status === "draft") continue;
    if (i.invoiceType === "proforma") continue;
    const balance = +(Number(i.total) - Number(i.paidAmount)).toFixed(2);
    if (balance <= 0) continue;
    const dueDate = i.dueDate ? new Date(i.dueDate) : today;
    const days = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400_000));
    const accId = i.accountId;
    const r = rowsByAccount.get(accId) ?? {
      accountId: accId, accountName: i.accountName ?? "Unknown",
      bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, total: 0,
    };
    if (days <= 30) r.bucket0to30 += balance;
    else if (days <= 60) r.bucket31to60 += balance;
    else if (days <= 90) r.bucket61to90 += balance;
    else r.bucket90Plus += balance;
    r.total += balance;
    rowsByAccount.set(accId, r);
  }
  const rows = Array.from(rowsByAccount.values()).map(r => ({
    accountId: r.accountId, accountName: r.accountName,
    bucket0to30: +r.bucket0to30.toFixed(2), bucket31to60: +r.bucket31to60.toFixed(2),
    bucket61to90: +r.bucket61to90.toFixed(2), bucket90Plus: +r.bucket90Plus.toFixed(2),
    total: +r.total.toFixed(2),
  })).sort((a, b) => b.total - a.total);
  const totals = rows.reduce((acc, r) => ({
    bucket0to30: +(acc.bucket0to30 + r.bucket0to30).toFixed(2),
    bucket31to60: +(acc.bucket31to60 + r.bucket31to60).toFixed(2),
    bucket61to90: +(acc.bucket61to90 + r.bucket61to90).toFixed(2),
    bucket90Plus: +(acc.bucket90Plus + r.bucket90Plus).toFixed(2),
    total: +(acc.total + r.total).toFixed(2),
  }), { bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, total: 0 });
  res.json({ rows, totals });
});

router.get("/financial/gst-report", requireAuth, async (req, res): Promise<void> => {
  const type = (typeof req.query.type === "string" ? req.query.type : "gstr1");
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  const invs = await db.select({
    id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
    invoiceDate: invoicesTable.invoiceDate, invoiceType: invoicesTable.invoiceType,
    accountName: accountsTable.name, buyerGstin: invoicesTable.buyerGstin,
    placeOfSupply: invoicesTable.placeOfSupply, supplyType: invoicesTable.supplyType,
    taxableAmount: invoicesTable.taxableAmount,
    cgstAmount: invoicesTable.cgstAmount, sgstAmount: invoicesTable.sgstAmount,
    igstAmount: invoicesTable.igstAmount, total: invoicesTable.total, status: invoicesTable.status,
  }).from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.accountId))
    .where(and(gte(invoicesTable.invoiceDate, start), lte(invoicesTable.invoiceDate, endDate))!);
  const filtered = invs.filter(i => i.status !== "draft" && i.status !== "cancelled" && i.invoiceType !== "proforma");
  const rows = filtered.map(i => ({
    invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate,
    accountName: i.accountName, buyerGstin: i.buyerGstin,
    placeOfSupply: i.placeOfSupply, supplyType: i.supplyType,
    taxableAmount: Number(i.taxableAmount),
    cgstAmount: Number(i.cgstAmount), sgstAmount: Number(i.sgstAmount),
    igstAmount: Number(i.igstAmount), total: Number(i.total),
  }));
  const totals = rows.reduce((acc, r) => ({
    taxableAmount: +(acc.taxableAmount + r.taxableAmount).toFixed(2),
    cgstAmount: +(acc.cgstAmount + r.cgstAmount).toFixed(2),
    sgstAmount: +(acc.sgstAmount + r.sgstAmount).toFixed(2),
    igstAmount: +(acc.igstAmount + r.igstAmount).toFixed(2),
    total: +(acc.total + r.total).toFixed(2),
  }), { taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, total: 0 });

  // HSN summary across line items in those invoices
  const invIds = filtered.map(i => i.id);
  let hsnRows: Array<{ hsnCode: string; description: string | null; quantity: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; total: number; }> = [];
  if (invIds.length) {
    const items = await db.select({
      invoiceId: invoiceLineItemsTable.invoiceId,
      hsnCode: invoiceLineItemsTable.hsnCode,
      productName: invoiceLineItemsTable.productName,
      quantity: invoiceLineItemsTable.quantity,
      lineTotal: invoiceLineItemsTable.lineTotal,
      gstRate: invoiceLineItemsTable.gstRate,
    }).from(invoiceLineItemsTable);
    const byInv = new Map<number, typeof filtered[number]>();
    for (const i of filtered) byInv.set(i.id, i);
    const buckets = new Map<string, { description: string | null; quantity: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; total: number; }>();
    for (const it of items) {
      const inv = byInv.get(it.invoiceId);
      if (!inv) continue;
      const hsn = it.hsnCode ?? "UNCODED";
      const lineNet = Number(it.lineTotal);
      const lineGst = lineNet * (Number(it.gstRate) / 100);
      const cgst = inv.supplyType === "intra" ? lineGst / 2 : 0;
      const sgst = inv.supplyType === "intra" ? lineGst - cgst : 0;
      const igst = inv.supplyType === "inter" ? lineGst : 0;
      const b = buckets.get(hsn) ?? { description: it.productName, quantity: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, total: 0 };
      b.quantity += Number(it.quantity);
      b.taxableAmount += lineNet;
      b.cgstAmount += cgst;
      b.sgstAmount += sgst;
      b.igstAmount += igst;
      b.total += lineNet + lineGst;
      buckets.set(hsn, b);
    }
    hsnRows = Array.from(buckets.entries()).map(([hsnCode, b]) => ({
      hsnCode, description: b.description,
      quantity: +b.quantity.toFixed(2),
      taxableAmount: +b.taxableAmount.toFixed(2),
      cgstAmount: +b.cgstAmount.toFixed(2),
      sgstAmount: +b.sgstAmount.toFixed(2),
      igstAmount: +b.igstAmount.toFixed(2),
      total: +b.total.toFixed(2),
    })).sort((a, b) => b.total - a.total);
  }
  res.json({ type, month, year, rows, hsnRows, totals });
});

export default router;

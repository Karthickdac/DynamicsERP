import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import {
  db, vendorPaymentsTable, vendorInvoicesTable, vendorsTable,
} from "@workspace/db";
import { CreateVendorPaymentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";

const router: IRouter = Router();

const vpSelect = {
  id: vendorPaymentsTable.id,
  paymentNumber: vendorPaymentsTable.paymentNumber,
  vendorInvoiceId: vendorPaymentsTable.vendorInvoiceId,
  vendorInvoiceNumber: vendorInvoicesTable.vendorInvoiceNumber,
  vendorId: vendorPaymentsTable.vendorId,
  vendorName: vendorsTable.name,
  amount: vendorPaymentsTable.amount,
  paymentDate: vendorPaymentsTable.paymentDate,
  paymentMode: vendorPaymentsTable.paymentMode,
  referenceNumber: vendorPaymentsTable.referenceNumber,
  notes: vendorPaymentsTable.notes,
  recordedById: vendorPaymentsTable.recordedById,
  createdAt: vendorPaymentsTable.createdAt,
};

function selectVp() {
  return db.select(vpSelect).from(vendorPaymentsTable)
    .leftJoin(vendorInvoicesTable, eq(vendorInvoicesTable.id, vendorPaymentsTable.vendorInvoiceId))
    .leftJoin(vendorsTable, eq(vendorsTable.id, vendorPaymentsTable.vendorId));
}

function vpDto(v: Awaited<ReturnType<typeof selectVp>>[number]) {
  return {
    id: v.id, paymentNumber: v.paymentNumber,
    vendorInvoiceId: v.vendorInvoiceId, vendorInvoiceNumber: v.vendorInvoiceNumber,
    vendorId: v.vendorId, vendorName: v.vendorName,
    amount: Number(v.amount), paymentDate: v.paymentDate, paymentMode: v.paymentMode,
    referenceNumber: v.referenceNumber, notes: v.notes,
    recordedById: v.recordedById,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/vendor-payments", requireAuth, async (req, res): Promise<void> => {
  const vendorId = req.query.vendorId ? Number(req.query.vendorId) : NaN;
  const viId = req.query.vendorInvoiceId ? Number(req.query.vendorInvoiceId) : NaN;
  const filters: SQL[] = [];
  if (Number.isFinite(vendorId)) filters.push(eq(vendorPaymentsTable.vendorId, vendorId));
  if (Number.isFinite(viId)) filters.push(eq(vendorPaymentsTable.vendorInvoiceId, viId));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await selectVp().where(where).orderBy(desc(vendorPaymentsTable.paymentDate), desc(vendorPaymentsTable.id))
    : await selectVp().orderBy(desc(vendorPaymentsTable.paymentDate), desc(vendorPaymentsTable.id));
  res.json(rows.map(vpDto));
});

router.post("/vendor-payments", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVendorPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (d.amount <= 0) { res.status(400).json({ error: "Amount must be > 0" }); return; }
  try {
    const newId = await db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT id, vendor_id, amount, paid_amount, status FROM ${vendorInvoicesTable} WHERE id = ${d.vendorInvoiceId} FOR UPDATE`,
      );
      const locked = ((lockResult as any).rows ?? lockResult) as Array<{ id: number; vendor_id: number; amount: string; paid_amount: string; status: string }>;
      const vi = locked[0];
      if (!vi) { const e = new Error("not_found"); (e as any).code = 404; throw e; }
      const total = Number(vi.amount);
      const paidExisting = Number(vi.paid_amount);
      if (paidExisting + d.amount > total + 0.01) {
        const e = new Error(`Payment exceeds vendor invoice balance (₹${(total - paidExisting).toFixed(2)})`); (e as any).code = 400; throw e;
      }
      const number = await nextDocNumber(tx, "VPAY", vendorPaymentsTable, vendorPaymentsTable.paymentNumber);
      const [row] = await tx.insert(vendorPaymentsTable).values({
        paymentNumber: number,
        vendorInvoiceId: d.vendorInvoiceId,
        vendorId: vi.vendor_id,
        amount: String(d.amount),
        paymentDate: new Date(d.paymentDate).toISOString().slice(0, 10),
        paymentMode: d.paymentMode,
        referenceNumber: d.referenceNumber ?? null,
        notes: d.notes ?? null,
        recordedById: req.user?.id ?? null,
      }).returning({ id: vendorPaymentsTable.id });
      const newPaid = paidExisting + d.amount;
      const newStatus = newPaid >= total - 0.01 ? "paid" : "partially_paid";
      await tx.update(vendorInvoicesTable).set({
        paidAmount: String(+newPaid.toFixed(2)),
        status: newStatus,
      }).where(eq(vendorInvoicesTable.id, d.vendorInvoiceId));
      return row.id;
    });
    const [out] = await selectVp().where(eq(vendorPaymentsTable.id, newId));
    res.status(201).json(vpDto(out));
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Vendor invoice not found" }); return; }
    if (err?.code === 400) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});

export default router;

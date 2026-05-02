import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import {
  db, paymentsTable, invoicesTable, accountsTable, usersTable,
} from "@workspace/db";
import { CreatePaymentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const pSelect = {
  id: paymentsTable.id,
  paymentNumber: paymentsTable.paymentNumber,
  invoiceId: paymentsTable.invoiceId,
  invoiceNumber: invoicesTable.invoiceNumber,
  accountId: paymentsTable.accountId,
  accountName: accountsTable.name,
  amount: paymentsTable.amount,
  paymentDate: paymentsTable.paymentDate,
  paymentMode: paymentsTable.paymentMode,
  referenceNumber: paymentsTable.referenceNumber,
  notes: paymentsTable.notes,
  recordedById: paymentsTable.recordedById,
  rFirst: usersTable.firstName,
  rLast: usersTable.lastName,
  createdAt: paymentsTable.createdAt,
};

function selectPayment() {
  return db.select(pSelect).from(paymentsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId))
    .leftJoin(accountsTable, eq(accountsTable.id, paymentsTable.accountId))
    .leftJoin(usersTable, eq(usersTable.id, paymentsTable.recordedById));
}

function paymentDto(p: Awaited<ReturnType<typeof selectPayment>>[number]) {
  return {
    id: p.id, paymentNumber: p.paymentNumber, invoiceId: p.invoiceId,
    invoiceNumber: p.invoiceNumber, accountId: p.accountId, accountName: p.accountName,
    amount: Number(p.amount), paymentDate: p.paymentDate, paymentMode: p.paymentMode,
    referenceNumber: p.referenceNumber, notes: p.notes,
    recordedById: p.recordedById,
    recordedByName: p.rFirst ? `${p.rFirst} ${p.rLast ?? ""}`.trim() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

async function recomputeInvoiceStatusTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], invoiceId: number) {
  const [inv] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv) return;
  const pays = await tx.select({ amount: paymentsTable.amount }).from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId));
  const paid = pays.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(inv.total);
  let newStatus = inv.status;
  if (inv.status === "cancelled" || inv.status === "draft") {
    // don't auto-change these
  } else if (paid >= total && total > 0) {
    newStatus = "paid";
  } else if (paid > 0) {
    newStatus = "partially_paid";
  } else {
    newStatus = "sent";
  }
  await tx.update(invoicesTable).set({
    paidAmount: String(+paid.toFixed(2)),
    status: newStatus,
    updatedAt: sql`now()`,
  }).where(eq(invoicesTable.id, invoiceId));
}

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  const invoiceId = req.query.invoiceId ? Number(req.query.invoiceId) : NaN;
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const filters: SQL[] = [];
  if (Number.isFinite(invoiceId)) filters.push(eq(paymentsTable.invoiceId, invoiceId));
  if (Number.isFinite(accountId)) filters.push(eq(paymentsTable.accountId, accountId));
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectPayment();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(paymentsTable.paymentDate), desc(paymentsTable.id))
    : await baseQuery.orderBy(desc(paymentsTable.paymentDate), desc(paymentsTable.id));
  res.json(rows.map(paymentDto));
});

router.post("/payments", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (d.amount <= 0) { res.status(400).json({ error: "Amount must be > 0" }); return; }
  try {
    const newId = await db.transaction(async (tx) => {
      // Lock the invoice row to serialise concurrent payment inserts
      const lockResult = await tx.execute(
        sql`SELECT id, status, total, paid_amount, account_id FROM ${invoicesTable} WHERE id = ${d.invoiceId} FOR UPDATE`,
      );
      const lockedRows = ((lockResult as any).rows ?? lockResult) as Array<{
        id: number; status: string; total: string; paid_amount: string; account_id: number;
      }>;
      const inv = lockedRows[0];
      if (!inv) { const e = new Error("not_found"); (e as any).code = 404; throw e; }
      if (inv.status === "cancelled" || inv.status === "draft") {
        const e = new Error(`Cannot record payment on ${inv.status} invoice`); (e as any).code = 409; throw e;
      }
      const total = Number(inv.total);
      const paidExisting = Number(inv.paid_amount);
      if (paidExisting + d.amount > total + 0.01) {
        const e = new Error(`Payment exceeds invoice balance (₹${(total - paidExisting).toFixed(2)})`); (e as any).code = 400; throw e;
      }
      const number = await nextDocNumber(tx, "PAY", paymentsTable, paymentsTable.paymentNumber);
      const [row] = await tx.insert(paymentsTable).values({
        paymentNumber: number,
        invoiceId: d.invoiceId,
        accountId: inv.account_id,
        amount: String(d.amount),
        paymentDate: new Date(d.paymentDate).toISOString().slice(0, 10),
        paymentMode: d.paymentMode,
        referenceNumber: d.referenceNumber ?? null,
        notes: d.notes ?? null,
        recordedById: req.user?.id ?? null,
      }).returning({ id: paymentsTable.id });
      await recomputeInvoiceStatusTx(tx, d.invoiceId);
      return row.id;
    });
    const [out] = await selectPayment().where(eq(paymentsTable.id, newId));
    // Notify invoice creator (and the recorder if different)
    const [inv] = await db.select({
      createdById: invoicesTable.createdById, invoiceNumber: invoicesTable.invoiceNumber,
    }).from(invoicesTable).where(eq(invoicesTable.id, out.invoiceId));
    const recipientSet = new Set<number>();
    if (inv?.createdById) recipientSet.add(inv.createdById);
    if (req.user?.id && req.user.id !== inv?.createdById) recipientSet.add(req.user.id);
    if (recipientSet.size > 0) {
      dispatchSafe({
        userIds: Array.from(recipientSet), eventKey: "payment.received",
        title: `Payment received for ${inv?.invoiceNumber ?? `invoice #${out.invoiceId}`}`,
        body: `Amount: ₹${Number(out.amount).toFixed(2)} via ${out.paymentMode}`,
        link: `/invoices/${out.invoiceId}`, entityType: "invoice", entityId: out.invoiceId,
      });
    }
    res.status(201).json(paymentDto(out));
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (err?.code === 409) { res.status(409).json({ error: err.message }); return; }
    if (err?.code === 400) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});

router.delete("/payments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, id));
    if (!pay) { const e = new Error("not_found"); (e as any).code = 404; throw e; }
    // Lock invoice row before mutating dependent state
    await tx.execute(sql`SELECT id FROM ${invoicesTable} WHERE id = ${pay.invoiceId} FOR UPDATE`);
    await tx.delete(paymentsTable).where(eq(paymentsTable.id, id));
    await recomputeInvoiceStatusTx(tx, pay.invoiceId);
  }).catch((err: any) => {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    throw err;
  });
  if (!res.headersSent) res.status(204).end();
});

export default router;

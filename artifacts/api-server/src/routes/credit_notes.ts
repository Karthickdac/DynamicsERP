import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import {
  db, creditNotesTable, invoicesTable, accountsTable,
} from "@workspace/db";
import { CreateCreditNoteBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const cnSelect = {
  id: creditNotesTable.id,
  creditNoteNumber: creditNotesTable.creditNoteNumber,
  invoiceId: creditNotesTable.invoiceId,
  invoiceNumber: invoicesTable.invoiceNumber,
  accountId: creditNotesTable.accountId,
  accountName: accountsTable.name,
  amount: creditNotesTable.amount,
  reason: creditNotesTable.reason,
  status: creditNotesTable.status,
  issueDate: creditNotesTable.issueDate,
  notes: creditNotesTable.notes,
  createdById: creditNotesTable.createdById,
  createdAt: creditNotesTable.createdAt,
};

function selectCreditNote() {
  return db.select(cnSelect).from(creditNotesTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, creditNotesTable.invoiceId))
    .leftJoin(accountsTable, eq(accountsTable.id, creditNotesTable.accountId));
}

function cnDto(c: Awaited<ReturnType<typeof selectCreditNote>>[number]) {
  return {
    id: c.id, creditNoteNumber: c.creditNoteNumber, invoiceId: c.invoiceId,
    invoiceNumber: c.invoiceNumber, accountId: c.accountId, accountName: c.accountName,
    amount: Number(c.amount), reason: c.reason, status: c.status, issueDate: c.issueDate,
    notes: c.notes, createdById: c.createdById, createdAt: c.createdAt.toISOString(),
  };
}


router.get("/credit-notes", requireAuth, async (req, res): Promise<void> => {
  const invoiceId = req.query.invoiceId ? Number(req.query.invoiceId) : NaN;
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const filters: SQL[] = [];
  if (Number.isFinite(invoiceId)) filters.push(eq(creditNotesTable.invoiceId, invoiceId));
  if (Number.isFinite(accountId)) filters.push(eq(creditNotesTable.accountId, accountId));
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectCreditNote();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(creditNotesTable.issueDate), desc(creditNotesTable.id))
    : await baseQuery.orderBy(desc(creditNotesTable.issueDate), desc(creditNotesTable.id));
  res.json(rows.map(cnDto));
});

router.post("/credit-notes", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCreditNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, d.invoiceId));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (inv.status === "draft" || inv.status === "cancelled") {
    res.status(409).json({ error: `Cannot issue credit note on ${inv.status} invoice` }); return;
  }
  if (d.amount <= 0 || d.amount > Number(inv.total)) {
    res.status(400).json({ error: "Credit note amount must be between 0 and invoice total" }); return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const newId = await db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, "CN", creditNotesTable, creditNotesTable.creditNoteNumber);
    const [row] = await tx.insert(creditNotesTable).values({
      creditNoteNumber: number,
      invoiceId: d.invoiceId,
      accountId: inv.accountId,
      amount: String(d.amount),
      reason: d.reason,
      status: "issued",
      issueDate: d.issueDate ? new Date(d.issueDate).toISOString().slice(0, 10) : today,
      notes: d.notes ?? null,
      createdById: req.user?.id ?? null,
    }).returning({ id: creditNotesTable.id });
    return row.id;
  });
  const [out] = await selectCreditNote().where(eq(creditNotesTable.id, newId));
  res.status(201).json(cnDto(out));
});

router.post("/credit-notes/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [cn] = await db.select().from(creditNotesTable).where(eq(creditNotesTable.id, id));
  if (!cn) { res.status(404).json({ error: "Not found" }); return; }
  if (cn.status === "cancelled") { res.status(409).json({ error: "Already cancelled" }); return; }
  await db.update(creditNotesTable).set({ status: "cancelled" }).where(eq(creditNotesTable.id, id));
  const [out] = await selectCreditNote().where(eq(creditNotesTable.id, id));
  res.json(cnDto(out));
});

export default router;

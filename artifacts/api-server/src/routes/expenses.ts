import { Router, type IRouter } from "express";
import { eq, desc, and, or, sql, type SQL } from "drizzle-orm";
import {
  db, expensesTable, projectsTable, usersTable,
} from "@workspace/db";
import { CreateExpenseBody, UpdateExpenseBody, RejectExpenseBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { nextDocNumber } from "../lib/numbering";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

const eSelect = {
  id: expensesTable.id,
  expenseNumber: expensesTable.expenseNumber,
  submittedById: expensesTable.submittedById,
  submittedFirst: usersTable.firstName,
  submittedLast: usersTable.lastName,
  projectId: expensesTable.projectId,
  projectName: projectsTable.name,
  category: expensesTable.category,
  amount: expensesTable.amount,
  expenseDate: expensesTable.expenseDate,
  description: expensesTable.description,
  status: expensesTable.status,
  receiptUrl: expensesTable.receiptUrl,
  notes: expensesTable.notes,
  approvedById: expensesTable.approvedById,
  approvedAt: expensesTable.approvedAt,
  rejectedReason: expensesTable.rejectedReason,
  reimbursedAt: expensesTable.reimbursedAt,
  createdAt: expensesTable.createdAt,
  updatedAt: expensesTable.updatedAt,
};

function selectExpense() {
  return db.select(eSelect).from(expensesTable)
    .leftJoin(usersTable, eq(usersTable.id, expensesTable.submittedById))
    .leftJoin(projectsTable, eq(projectsTable.id, expensesTable.projectId));
}

function expenseDto(e: Awaited<ReturnType<typeof selectExpense>>[number]) {
  return {
    id: e.id, expenseNumber: e.expenseNumber,
    submittedById: e.submittedById,
    submittedByName: e.submittedFirst ? `${e.submittedFirst} ${e.submittedLast ?? ""}`.trim() : null,
    projectId: e.projectId, projectName: e.projectName,
    category: e.category, amount: Number(e.amount),
    expenseDate: e.expenseDate, description: e.description,
    status: e.status, receiptUrl: e.receiptUrl, notes: e.notes,
    approvedById: e.approvedById, approvedByName: null,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
    rejectedReason: e.rejectedReason,
    reimbursedAt: e.reimbursedAt ? e.reimbursedAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const projectId = req.query.projectId ? Number(req.query.projectId) : NaN;
  const submittedById = req.query.submittedById ? Number(req.query.submittedById) : NaN;
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const filters: SQL[] = [];
  if (status) filters.push(eq(expensesTable.status, status));
  if (Number.isFinite(projectId)) filters.push(eq(expensesTable.projectId, projectId));
  if (Number.isFinite(submittedById)) filters.push(eq(expensesTable.submittedById, submittedById));
  if (category) filters.push(eq(expensesTable.category, category));
  const where = filters.length ? and(...filters) : undefined;
  const rows = where
    ? await selectExpense().where(where).orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id))
    : await selectExpense().orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
  res.json(rows.map(expenseDto));
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (d.amount <= 0) { res.status(400).json({ error: "Amount must be > 0" }); return; }
  if (!req.user?.id) { res.status(401).json({ error: "Auth required" }); return; }
  const submittedBy = req.user.id;
  const newId = await db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, "EXP", expensesTable, expensesTable.expenseNumber);
    const [row] = await tx.insert(expensesTable).values({
      expenseNumber: number,
      submittedById: submittedBy,
      projectId: d.projectId ?? null,
      category: d.category,
      amount: String(d.amount),
      expenseDate: new Date(d.expenseDate).toISOString().slice(0, 10),
      description: d.description ?? null,
      receiptUrl: d.receiptUrl ?? null,
      notes: d.notes ?? null,
      status: "draft",
    }).returning({ id: expensesTable.id });
    return row.id;
  });
  const [out] = await selectExpense().where(eq(expensesTable.id, newId));
  res.status(201).json(expenseDto(out));
});

router.get("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(expenseDto(row));
});

router.patch("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!["draft", "rejected"].includes(existing.status)) {
    res.status(409).json({ error: "Cannot edit a submitted/approved expense" }); return;
  }
  const d = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.projectId !== undefined) patch.projectId = d.projectId;
  if (d.category) patch.category = d.category;
  if (d.amount != null) patch.amount = String(d.amount);
  if (d.expenseDate) patch.expenseDate = new Date(d.expenseDate).toISOString().slice(0, 10);
  if (d.description !== undefined) patch.description = d.description;
  if (d.receiptUrl !== undefined) patch.receiptUrl = d.receiptUrl;
  if (d.notes !== undefined) patch.notes = d.notes;
  await db.update(expensesTable).set(patch).where(eq(expensesTable.id, id));
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  res.json(expenseDto(row!));
});

router.post("/expenses/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [e] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!e) { res.status(404).json({ error: "Not found" }); return; }
  if (!["draft", "rejected"].includes(e.status)) { res.status(409).json({ error: "Only draft expenses can be submitted" }); return; }
  await db.update(expensesTable).set({ status: "submitted", rejectedReason: null, updatedAt: sql`now()` }).where(eq(expensesTable.id, id));
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  // Notify approvers (admin + finance)
  const approvers = await db.select({ id: usersTable.id }).from(usersTable)
    .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "finance"))!);
  if (approvers.length > 0) {
    dispatchSafe({
      userIds: approvers.map(a => a.id), eventKey: "expense.approval_required",
      title: `Expense submitted: ${row!.expenseNumber}`,
      body: `${row!.category} — ₹${Number(row!.amount).toFixed(2)}`,
      link: `/expenses`, entityType: "expense", entityId: id,
    });
  }
  res.json(expenseDto(row!));
});

router.post("/expenses/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [e] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!e) { res.status(404).json({ error: "Not found" }); return; }
  if (e.status !== "submitted") { res.status(409).json({ error: "Only submitted expenses can be approved" }); return; }
  await db.update(expensesTable).set({
    status: "approved",
    approvedById: req.user?.id ?? null,
    approvedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(expensesTable.id, id));
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  dispatchSafe({
    userIds: [e.submittedById], eventKey: "expense.approved",
    title: `Expense approved: ${row!.expenseNumber}`,
    body: `Your ${row!.category} expense of ₹${Number(row!.amount).toFixed(2)} was approved.`,
    link: `/expenses`, entityType: "expense", entityId: id,
  });
  res.json(expenseDto(row!));
});

router.post("/expenses/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RejectExpenseBody.safeParse(req.body ?? {});
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;
  const [e] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!e) { res.status(404).json({ error: "Not found" }); return; }
  if (e.status !== "submitted") { res.status(409).json({ error: "Only submitted expenses can be rejected" }); return; }
  await db.update(expensesTable).set({
    status: "rejected", rejectedReason: reason, updatedAt: sql`now()`,
  }).where(eq(expensesTable.id, id));
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  dispatchSafe({
    userIds: [e.submittedById], eventKey: "expense.rejected",
    title: `Expense rejected: ${row!.expenseNumber}`,
    body: reason ?? `Your ${row!.category} expense was rejected.`,
    link: `/expenses`, entityType: "expense", entityId: id,
  });
  res.json(expenseDto(row!));
});

router.post("/expenses/:id/reimburse", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [e] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!e) { res.status(404).json({ error: "Not found" }); return; }
  if (e.status !== "approved") { res.status(409).json({ error: "Only approved expenses can be reimbursed" }); return; }
  await db.update(expensesTable).set({
    status: "reimbursed", reimbursedAt: sql`now()`, updatedAt: sql`now()`,
  }).where(eq(expensesTable.id, id));
  const [row] = await selectExpense().where(eq(expensesTable.id, id));
  res.json(expenseDto(row!));
});

export default router;

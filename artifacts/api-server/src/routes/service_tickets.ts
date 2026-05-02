import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import {
  db, serviceTicketsTable, accountsTable, projectsTable, usersTable, serviceVisitsTable,
} from "@workspace/db";
import { CreateServiceTicketBody, UpdateServiceTicketBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function dateOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

const tSelect = {
  id: serviceTicketsTable.id,
  ticketNumber: serviceTicketsTable.ticketNumber,
  projectId: serviceTicketsTable.projectId,
  projectName: projectsTable.name,
  accountId: serviceTicketsTable.accountId,
  accountName: accountsTable.name,
  contactId: serviceTicketsTable.contactId,
  subject: serviceTicketsTable.subject,
  description: serviceTicketsTable.description,
  category: serviceTicketsTable.category,
  priority: serviceTicketsTable.priority,
  status: serviceTicketsTable.status,
  assigneeId: serviceTicketsTable.assigneeId,
  assigneeFirst: usersTable.firstName,
  assigneeLast: usersTable.lastName,
  reportedAt: serviceTicketsTable.reportedAt,
  resolvedAt: serviceTicketsTable.resolvedAt,
  resolutionNotes: serviceTicketsTable.resolutionNotes,
  createdAt: serviceTicketsTable.createdAt,
  updatedAt: serviceTicketsTable.updatedAt,
};

function ticketDto(t: { [K in keyof typeof tSelect]: unknown }) {
  const x = t as Record<string, any>;
  return {
    id: x.id, ticketNumber: x.ticketNumber,
    projectId: x.projectId, projectName: x.projectName,
    accountId: x.accountId, accountName: x.accountName,
    contactId: x.contactId,
    subject: x.subject, description: x.description,
    category: x.category, priority: x.priority, status: x.status,
    assigneeId: x.assigneeId,
    assigneeName: x.assigneeFirst ? `${x.assigneeFirst} ${x.assigneeLast ?? ""}`.trim() : null,
    reportedAt: x.reportedAt, resolvedAt: x.resolvedAt,
    resolutionNotes: x.resolutionNotes,
    createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(),
  };
}

function selectTicket() {
  return db.select(tSelect).from(serviceTicketsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, serviceTicketsTable.projectId))
    .leftJoin(accountsTable, eq(accountsTable.id, serviceTicketsTable.accountId))
    .leftJoin(usersTable, eq(usersTable.id, serviceTicketsTable.assigneeId));
}

async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: serviceTicketsTable.id }).from(serviceTicketsTable);
  return `TKT-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

router.get("/service-tickets", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const assigneeId = req.query.assigneeId ? Number(req.query.assigneeId) : NaN;
  const accountId = req.query.accountId ? Number(req.query.accountId) : NaN;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters: SQL[] = [];
  if (status) filters.push(eq(serviceTicketsTable.status, status));
  if (Number.isFinite(assigneeId)) filters.push(eq(serviceTicketsTable.assigneeId, assigneeId));
  if (Number.isFinite(accountId)) filters.push(eq(serviceTicketsTable.accountId, accountId));
  if (search) {
    const or1 = or(
      ilike(serviceTicketsTable.subject, `%${search}%`),
      ilike(serviceTicketsTable.ticketNumber, `%${search}%`),
    );
    if (or1) filters.push(or1);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = selectTicket();
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(serviceTicketsTable.createdAt))
    : await baseQuery.orderBy(desc(serviceTicketsTable.createdAt));
  res.json(rows.map(ticketDto));
});

router.post("/service-tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateServiceTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const number = await nextTicketNumber();
  const [row] = await db.insert(serviceTicketsTable).values({
    ticketNumber: number,
    projectId: d.projectId ?? null,
    accountId: d.accountId ?? null,
    contactId: d.contactId ?? null,
    subject: d.subject,
    description: d.description ?? null,
    category: d.category ?? "complaint",
    priority: d.priority ?? "medium",
    assigneeId: d.assigneeId ?? null,
    status: d.assigneeId ? "assigned" : "open",
    reportedAt: dateOrNull(d.reportedAt)!,
  }).returning({ id: serviceTicketsTable.id });
  const [out] = await selectTicket().where(eq(serviceTicketsTable.id, row.id));
  if (d.assigneeId) {
    dispatchSafe({
      userIds: [d.assigneeId], eventKey: "ticket.assigned",
      title: `Service ticket assigned: ${number}`,
      body: d.subject,
      link: `/service-tickets/${row.id}`, entityType: "service_ticket", entityId: row.id,
    });
  }
  res.status(201).json(ticketDto(out));
});

router.get("/service-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await selectTicket().where(eq(serviceTicketsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const visits = await db.select({
    id: serviceVisitsTable.id, ticketId: serviceVisitsTable.ticketId,
    amcContractId: serviceVisitsTable.amcContractId,
    scheduledDate: serviceVisitsTable.scheduledDate,
    completedDate: serviceVisitsTable.completedDate,
    engineerId: serviceVisitsTable.engineerId,
    engineerFirst: usersTable.firstName, engineerLast: usersTable.lastName,
    visitType: serviceVisitsTable.visitType, status: serviceVisitsTable.status,
    notes: serviceVisitsTable.notes,
    createdAt: serviceVisitsTable.createdAt, updatedAt: serviceVisitsTable.updatedAt,
  }).from(serviceVisitsTable)
    .leftJoin(usersTable, eq(usersTable.id, serviceVisitsTable.engineerId))
    .where(eq(serviceVisitsTable.ticketId, id))
    .orderBy(desc(serviceVisitsTable.scheduledDate));
  res.json({
    ...ticketDto(row),
    visits: visits.map(v => ({
      id: v.id, ticketId: v.ticketId, amcContractId: v.amcContractId,
      scheduledDate: v.scheduledDate, completedDate: v.completedDate,
      engineerId: v.engineerId,
      engineerName: v.engineerFirst ? `${v.engineerFirst} ${v.engineerLast ?? ""}`.trim() : null,
      visitType: v.visitType, status: v.status, notes: v.notes,
      createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
    })),
  });
});

router.patch("/service-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateServiceTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [prev] = await db.select().from(serviceTicketsTable).where(eq(serviceTicketsTable.id, id));
  if (!prev) { res.status(404).json({ error: "Not found" }); return; }
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.subject !== undefined) update.subject = d.subject;
  if (d.description !== undefined) update.description = d.description ?? null;
  if (d.category !== undefined) update.category = d.category;
  if (d.priority !== undefined) update.priority = d.priority;
  if (d.status !== undefined) update.status = d.status;
  if (d.assigneeId !== undefined) update.assigneeId = d.assigneeId ?? null;
  if (d.resolvedAt !== undefined) update.resolvedAt = dateOrNull(d.resolvedAt);
  if (d.resolutionNotes !== undefined) update.resolutionNotes = d.resolutionNotes ?? null;
  // Auto-set resolvedAt when status moves to resolved
  if (d.status === "resolved" && d.resolvedAt === undefined) {
    update.resolvedAt = new Date().toISOString().slice(0, 10);
  }
  await db.update(serviceTicketsTable).set(update).where(eq(serviceTicketsTable.id, id));
  const [out] = await selectTicket().where(eq(serviceTicketsTable.id, id));
  if (d.assigneeId !== undefined && d.assigneeId !== null && d.assigneeId !== prev.assigneeId) {
    dispatchSafe({
      userIds: [d.assigneeId], eventKey: "ticket.assigned",
      title: `Service ticket assigned: ${prev.ticketNumber}`,
      body: prev.subject,
      link: `/service-tickets/${id}`, entityType: "service_ticket", entityId: id,
    });
  }
  res.json(ticketDto(out));
});

router.delete("/service-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(serviceTicketsTable).where(eq(serviceTicketsTable.id, id));
  res.status(204).end();
});

export default router;

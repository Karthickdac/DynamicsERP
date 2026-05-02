import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadActivitiesTable,
  accountsTable,
  contactsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateLeadBody,
  UpdateLeadBody,
  CreateLeadActivityBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { dispatchSafe } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

type LeadJoined = {
  id: number; title: string; accountId: number | null; accountName: string | null;
  contactId: number | null; contactFirst: string | null; contactLast: string | null;
  status: string; source: string;
  capacityKwp: string | null; estimatedValue: string | null;
  expectedCloseDate: string | null;
  assignedToId: number | null; assignedFirst: string | null; assignedLast: string | null;
  siteAddress: string | null; siteCity: string | null; siteState: string | null;
  notes: string | null; createdAt: Date; updatedAt: Date;
};

function leadDto(l: LeadJoined) {
  return {
    id: l.id,
    title: l.title,
    accountId: l.accountId,
    accountName: l.accountName,
    contactId: l.contactId,
    contactName: l.contactFirst ? `${l.contactFirst} ${l.contactLast ?? ""}`.trim() : null,
    status: l.status,
    source: l.source,
    capacityKwp: l.capacityKwp != null ? Number(l.capacityKwp) : null,
    estimatedValue: l.estimatedValue != null ? Number(l.estimatedValue) : null,
    expectedCloseDate: l.expectedCloseDate,
    assignedToId: l.assignedToId,
    assignedToName: l.assignedFirst ? `${l.assignedFirst} ${l.assignedLast ?? ""}`.trim() : null,
    siteAddress: l.siteAddress,
    siteCity: l.siteCity,
    siteState: l.siteState,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

const leadSelect = {
  id: leadsTable.id,
  title: leadsTable.title,
  accountId: leadsTable.accountId,
  accountName: accountsTable.name,
  contactId: leadsTable.contactId,
  contactFirst: contactsTable.firstName,
  contactLast: contactsTable.lastName,
  status: leadsTable.status,
  source: leadsTable.source,
  capacityKwp: leadsTable.capacityKwp,
  estimatedValue: leadsTable.estimatedValue,
  expectedCloseDate: leadsTable.expectedCloseDate,
  assignedToId: leadsTable.assignedToId,
  assignedFirst: usersTable.firstName,
  assignedLast: usersTable.lastName,
  siteAddress: leadsTable.siteAddress,
  siteCity: leadsTable.siteCity,
  siteState: leadsTable.siteState,
  notes: leadsTable.notes,
  createdAt: leadsTable.createdAt,
  updatedAt: leadsTable.updatedAt,
};

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const assignedRaw = req.query.assignedTo;
  const assignedTo = assignedRaw ? Number(assignedRaw) : NaN;

  const filters: SQL[] = [];
  if (status) filters.push(eq(leadsTable.status, status));
  if (Number.isFinite(assignedTo)) filters.push(eq(leadsTable.assignedToId, assignedTo));
  if (search) {
    const orClause = or(
      ilike(leadsTable.title, `%${search}%`),
      ilike(leadsTable.siteCity, `%${search}%`),
      ilike(accountsTable.name, `%${search}%`),
    );
    if (orClause) filters.push(orClause);
  }
  const where = filters.length ? and(...filters) : undefined;
  const baseQuery = db
    .select(leadSelect)
    .from(leadsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, leadsTable.accountId))
    .leftJoin(contactsTable, eq(contactsTable.id, leadsTable.contactId))
    .leftJoin(usersTable, eq(usersTable.id, leadsTable.assignedToId));
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(leadsTable.updatedAt))
    : await baseQuery.orderBy(desc(leadsTable.updatedAt));
  res.json(rows.map(leadDto));
});

router.get("/leads/pipeline", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`count(*)::int`.as("count"),
      totalValue: sql<number>`coalesce(sum(${leadsTable.estimatedValue}), 0)::float`.as("total_value"),
    })
    .from(leadsTable)
    .groupBy(leadsTable.status);
  res.json(rows);
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const [row] = await db.insert(leadsTable).values({
    title: data.title,
    accountId: data.accountId ?? null,
    contactId: data.contactId ?? null,
    status: data.status,
    source: data.source,
    capacityKwp: data.capacityKwp != null ? String(data.capacityKwp) : null,
    estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
    expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString().slice(0, 10) : null,
    assignedToId: data.assignedToId ?? null,
    siteAddress: data.siteAddress ?? null,
    siteCity: data.siteCity ?? null,
    siteState: data.siteState ?? null,
    notes: data.notes ?? null,
  }).returning({ id: leadsTable.id });
  await db.insert(leadActivitiesTable).values({
    leadId: row.id,
    type: "note",
    title: "Lead created",
    description: data.title,
    userId: req.user?.id ?? null,
  });
  const [out] = await db.select(leadSelect).from(leadsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, leadsTable.accountId))
    .leftJoin(contactsTable, eq(contactsTable.id, leadsTable.contactId))
    .leftJoin(usersTable, eq(usersTable.id, leadsTable.assignedToId))
    .where(eq(leadsTable.id, row.id));
  if (data.assignedToId) {
    dispatchSafe({
      userIds: [data.assignedToId], eventKey: "lead.assigned",
      title: `Lead assigned: ${data.title}`,
      body: data.estimatedValue != null ? `Estimated value: ₹${Number(data.estimatedValue).toFixed(2)}` : null,
      link: `/leads/${row.id}`, entityType: "lead", entityId: row.id,
    });
  }
  res.status(201).json(leadDto(out));
});

router.get("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select(leadSelect).from(leadsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, leadsTable.accountId))
    .leftJoin(contactsTable, eq(contactsTable.id, leadsTable.contactId))
    .leftJoin(usersTable, eq(usersTable.id, leadsTable.assignedToId))
    .where(eq(leadsTable.id, id))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(leadDto(row));
});

router.patch("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [prev] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
  if (!prev) { res.status(404).json({ error: "Not found" }); return; }
  const data = parsed.data;
  await db.update(leadsTable).set({
    title: data.title,
    accountId: data.accountId ?? null,
    contactId: data.contactId ?? null,
    status: data.status,
    source: data.source,
    capacityKwp: data.capacityKwp != null ? String(data.capacityKwp) : null,
    estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
    expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString().slice(0, 10) : null,
    assignedToId: data.assignedToId ?? null,
    siteAddress: data.siteAddress ?? null,
    siteCity: data.siteCity ?? null,
    siteState: data.siteState ?? null,
    notes: data.notes ?? null,
    updatedAt: sql`now()`,
  }).where(eq(leadsTable.id, id));

  if (prev.status !== data.status) {
    await db.insert(leadActivitiesTable).values({
      leadId: id,
      type: "status_change",
      title: `Status changed: ${prev.status} → ${data.status}`,
      userId: req.user?.id ?? null,
    });
  }
  if ((prev.assignedToId ?? null) !== (data.assignedToId ?? null)) {
    await db.insert(leadActivitiesTable).values({
      leadId: id,
      type: "assignment",
      title: `Assignment updated`,
      userId: req.user?.id ?? null,
    });
    if (data.assignedToId) {
      dispatchSafe({
        userIds: [data.assignedToId], eventKey: "lead.assigned",
        title: `Lead assigned: ${data.title}`,
        body: data.estimatedValue != null ? `Estimated value: ₹${Number(data.estimatedValue).toFixed(2)}` : null,
        link: `/leads/${id}`, entityType: "lead", entityId: id,
      });
    }
  }

  const [out] = await db.select(leadSelect).from(leadsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, leadsTable.accountId))
    .leftJoin(contactsTable, eq(contactsTable.id, leadsTable.contactId))
    .leftJoin(usersTable, eq(usersTable.id, leadsTable.assignedToId))
    .where(eq(leadsTable.id, id));
  res.json(leadDto(out));
});

router.delete("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.status(204).end();
});

router.get("/leads/:leadId/activities", requireAuth, async (req, res): Promise<void> => {
  const leadId = parseId(req.params.leadId);
  if (leadId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db
    .select({
      id: leadActivitiesTable.id,
      leadId: leadActivitiesTable.leadId,
      type: leadActivitiesTable.type,
      title: leadActivitiesTable.title,
      description: leadActivitiesTable.description,
      userId: leadActivitiesTable.userId,
      userFirst: usersTable.firstName,
      userLast: usersTable.lastName,
      createdAt: leadActivitiesTable.createdAt,
    })
    .from(leadActivitiesTable)
    .leftJoin(usersTable, eq(usersTable.id, leadActivitiesTable.userId))
    .where(eq(leadActivitiesTable.leadId, leadId))
    .orderBy(desc(leadActivitiesTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id, leadId: r.leadId, type: r.type, title: r.title, description: r.description,
    userId: r.userId,
    userName: r.userFirst ? `${r.userFirst} ${r.userLast ?? ""}`.trim() : null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/leads/:leadId/activities", requireAuth, async (req, res): Promise<void> => {
  const leadId = parseId(req.params.leadId);
  if (leadId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateLeadActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(leadActivitiesTable).values({
    leadId,
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    userId: req.user?.id ?? null,
  }).returning();
  res.status(201).json({
    id: row.id, leadId: row.leadId, type: row.type, title: row.title,
    description: row.description, userId: row.userId,
    userName: req.user ? `${req.user.firstName} ${req.user.lastName}` : null,
    createdAt: row.createdAt.toISOString(),
  });
});

export default router;

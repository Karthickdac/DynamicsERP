import { Router, type IRouter } from "express";
import { sql, desc, eq } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadActivitiesTable,
  accountsTable,
  contactsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const ACTIVE = ["new", "qualified", "proposal", "negotiation"] as const;

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const [counts] = await db
    .select({
      activeLeads: sql<number>`count(*) filter (where ${leadsTable.status} in ('new','qualified','proposal','negotiation'))::int`,
      qualifiedLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'qualified')::int`,
      wonThisMonth: sql<number>`count(*) filter (where ${leadsTable.status} = 'won' and date_trunc('month', ${leadsTable.updatedAt}) = date_trunc('month', now()))::int`,
      pipelineValue: sql<number>`coalesce(sum(${leadsTable.estimatedValue}) filter (where ${leadsTable.status} in ('new','qualified','proposal','negotiation')), 0)::float`,
      wonCount: sql<number>`count(*) filter (where ${leadsTable.status} = 'won')::int`,
      lostCount: sql<number>`count(*) filter (where ${leadsTable.status} = 'lost')::int`,
    })
    .from(leadsTable);

  const [{ totalAccounts }] = await db
    .select({ totalAccounts: sql<number>`count(*)::int` })
    .from(accountsTable);
  const [{ totalContacts }] = await db
    .select({ totalContacts: sql<number>`count(*)::int` })
    .from(contactsTable);

  const leadsBySource = await db
    .select({
      source: leadsTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.source);

  const leadsByStatus = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${leadsTable.estimatedValue}), 0)::float`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.status);

  const revenueByMonth = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${leadsTable.updatedAt}), 'YYYY-MM')`,
      value: sql<number>`coalesce(sum(${leadsTable.estimatedValue}) filter (where ${leadsTable.status} = 'won'), 0)::float`,
    })
    .from(leadsTable)
    .groupBy(sql`date_trunc('month', ${leadsTable.updatedAt})`)
    .orderBy(sql`date_trunc('month', ${leadsTable.updatedAt})`);

  const winRate = counts.wonCount + counts.lostCount > 0
    ? (counts.wonCount / (counts.wonCount + counts.lostCount)) * 100
    : 0;

  res.json({
    activeLeads: counts.activeLeads,
    qualifiedLeads: counts.qualifiedLeads,
    wonThisMonth: counts.wonThisMonth,
    pipelineValue: counts.pipelineValue,
    totalAccounts,
    totalContacts,
    winRate,
    leadsBySource,
    leadsByStatus,
    revenueByMonth,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: leadActivitiesTable.id,
      type: leadActivitiesTable.type,
      title: leadActivitiesTable.title,
      description: leadActivitiesTable.description,
      userFirst: usersTable.firstName,
      userLast: usersTable.lastName,
      leadId: leadActivitiesTable.leadId,
      createdAt: leadActivitiesTable.createdAt,
    })
    .from(leadActivitiesTable)
    .leftJoin(usersTable, eq(usersTable.id, leadActivitiesTable.userId))
    .orderBy(desc(leadActivitiesTable.createdAt))
    .limit(20);
  res.json(rows.map(r => ({
    id: r.id,
    kind: r.type === "status_change" ? "lead_status_changed" :
          r.type === "assignment" ? "lead_assigned" :
          "activity_logged",
    title: r.title,
    description: r.description,
    userName: r.userFirst ? `${r.userFirst} ${r.userLast ?? ""}`.trim() : null,
    entityType: "lead",
    entityId: r.leadId,
    createdAt: r.createdAt.toISOString(),
  })));
});

void ACTIVE;
export default router;

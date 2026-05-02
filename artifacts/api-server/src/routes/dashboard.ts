import { Router, type IRouter } from "express";
import { sql, desc, eq, and, gte, lt, inArray, ne } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadActivitiesTable,
  accountsTable,
  contactsTable,
  usersTable,
  invoicesTable,
  paymentsTable,
  projectsTable,
  serviceTicketsTable,
  vendorInvoicesTable,
  expensesTable,
  approvalRequestsTable,
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

router.get("/dashboard/management", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

  // ---------- INVOICES (revenue, AR, top customers, trend) ----------
  const invs = await db.select({
    id: invoicesTable.id,
    accountId: invoicesTable.accountId,
    accountName: accountsTable.name,
    invoiceDate: invoicesTable.invoiceDate,
    dueDate: invoicesTable.dueDate,
    status: invoicesTable.status,
    invoiceType: invoicesTable.invoiceType,
    total: invoicesTable.total,
    paidAmount: invoicesTable.paidAmount,
  }).from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.accountId));

  let revenueMtd = 0, revenueYtd = 0, arOutstanding = 0, arOverdue = 0, overdueInvoiceCount = 0;
  const customerRevenue = new Map<number, { accountId: number; accountName: string; revenue: number; outstanding: number }>();
  const trend = new Map<string, { invoiced: number; collected: number }>();

  for (const i of invs) {
    if (i.status === "cancelled" || i.invoiceType === "proforma") continue;
    const total = Number(i.total);
    const paid = Number(i.paidAmount);
    const balance = Math.max(0, +(total - paid).toFixed(2));
    const overdue = i.dueDate && (i.status === "sent" || i.status === "partially_paid") && i.dueDate < today;

    if (i.invoiceDate >= monthStart) revenueMtd += total;
    if (i.invoiceDate >= yearStart) revenueYtd += total;
    if (i.status !== "paid") arOutstanding += balance;
    if (overdue) { arOverdue += balance; overdueInvoiceCount += 1; }

    if (i.invoiceDate >= twelveMonthsAgo) {
      const acc = customerRevenue.get(i.accountId) ?? {
        accountId: i.accountId, accountName: i.accountName ?? "Unknown",
        revenue: 0, outstanding: 0,
      };
      acc.revenue += total;
      acc.outstanding += balance;
      customerRevenue.set(i.accountId, acc);

      const key = i.invoiceDate.slice(0, 7);
      const t = trend.get(key) ?? { invoiced: 0, collected: 0 };
      t.invoiced += total;
      trend.set(key, t);
    }
  }

  // Collected (payments) for trend, MTD collected
  const pays = await db.select({
    amount: paymentsTable.amount,
    paymentDate: paymentsTable.paymentDate,
    invStatus: invoicesTable.status,
    invType: invoicesTable.invoiceType,
  }).from(paymentsTable)
    .leftJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId));

  let collectedMtd = 0;
  for (const p of pays) {
    if (p.invStatus === "cancelled" || p.invType === "proforma") continue;
    const amt = Number(p.amount);
    if (p.paymentDate >= monthStart) collectedMtd += amt;
    if (p.paymentDate >= twelveMonthsAgo) {
      const key = p.paymentDate.slice(0, 7);
      const t = trend.get(key) ?? { invoiced: 0, collected: 0 };
      t.collected += amt;
      trend.set(key, t);
    }
  }

  // Build a complete 12-month series so chart x-axis is even
  const trendSeries: { month: string; invoiced: number; collected: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = trend.get(key) ?? { invoiced: 0, collected: 0 };
    trendSeries.push({ month: key, invoiced: +t.invoiced.toFixed(2), collected: +t.collected.toFixed(2) });
  }

  const topCustomers = Array.from(customerRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(c => ({ accountId: c.accountId, accountName: c.accountName, revenue: +c.revenue.toFixed(2), outstanding: +c.outstanding.toFixed(2) }));

  // ---------- VENDOR PAYABLES (AP) ----------
  const vis = await db.select({
    amount: vendorInvoicesTable.amount, paidAmount: vendorInvoicesTable.paidAmount, status: vendorInvoicesTable.status,
  }).from(vendorInvoicesTable);
  let apOutstanding = 0, apInvoiceCount = 0;
  for (const v of vis) {
    if (v.status === "paid" || v.status === "cancelled") continue;
    const bal = Math.max(0, Number(v.amount) - Number(v.paidAmount));
    if (bal > 0) { apOutstanding += bal; apInvoiceCount += 1; }
  }

  // ---------- EXPENSES (MTD) ----------
  const [{ expensesMtd }] = await db.select({
    expensesMtd: sql<number>`coalesce(sum(${expensesTable.amount}) filter (where ${expensesTable.expenseDate} >= ${monthStart} and ${expensesTable.status} not in ('rejected','draft')), 0)::float`,
  }).from(expensesTable);

  // ---------- PROJECTS ----------
  const projectRows = await db.select({
    stage: projectsTable.stage, status: projectsTable.status,
    expectedEndDate: projectsTable.expectedEndDate,
  }).from(projectsTable);
  let activeProjects = 0, overdueProjects = 0, completedProjects = 0;
  const projectsByStage = new Map<string, number>();
  for (const p of projectRows) {
    if (p.status === "completed") { completedProjects += 1; continue; }
    if (p.status === "cancelled") continue;
    activeProjects += 1;
    projectsByStage.set(p.stage, (projectsByStage.get(p.stage) ?? 0) + 1);
    if (p.expectedEndDate && p.expectedEndDate < today) overdueProjects += 1;
  }

  // ---------- SERVICE TICKETS ----------
  const tickets = await db.select({
    status: serviceTicketsTable.status, priority: serviceTicketsTable.priority,
  }).from(serviceTicketsTable);
  let openTickets = 0, criticalOpenTickets = 0;
  for (const t of tickets) {
    if (t.status === "resolved" || t.status === "closed" || t.status === "cancelled") continue;
    openTickets += 1;
    if (t.priority === "high" || t.priority === "critical" || t.priority === "urgent") criticalOpenTickets += 1;
  }

  // ---------- PIPELINE & APPROVALS ----------
  const [pipe] = await db.select({
    pipelineValue: sql<number>`coalesce(sum(${leadsTable.estimatedValue}) filter (where ${leadsTable.status} in ('new','qualified','proposal','negotiation')), 0)::float`,
    activeLeads: sql<number>`count(*) filter (where ${leadsTable.status} in ('new','qualified','proposal','negotiation'))::int`,
  }).from(leadsTable);

  const [{ pendingApprovals }] = await db.select({
    pendingApprovals: sql<number>`count(*) filter (where ${approvalRequestsTable.status} = 'pending')::int`,
  }).from(approvalRequestsTable);

  // ---------- ALERTS (top 5 most actionable items for management) ----------
  const overdueInvoices = await db.select({
    invoiceNumber: invoicesTable.invoiceNumber,
    accountName: accountsTable.name,
    dueDate: invoicesTable.dueDate,
    balance: sql<number>`(${invoicesTable.total} - ${invoicesTable.paidAmount})::float`,
  }).from(invoicesTable)
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.accountId))
    .where(and(
      inArray(invoicesTable.status, ["sent", "partially_paid"]),
      ne(invoicesTable.invoiceType, "proforma"),
      lt(invoicesTable.dueDate, today),
    ))
    .orderBy(invoicesTable.dueDate)
    .limit(5);

  const projectsBlocked = await db.select({
    projectNumber: projectsTable.projectNumber,
    name: projectsTable.name,
    expectedEndDate: projectsTable.expectedEndDate,
    stage: projectsTable.stage,
  }).from(projectsTable)
    .where(and(
      lt(projectsTable.expectedEndDate, today),
      ne(projectsTable.status, "completed"),
      ne(projectsTable.status, "cancelled"),
    ))
    .orderBy(projectsTable.expectedEndDate)
    .limit(5);

  res.json({
    asOf: now.toISOString(),
    revenue: {
      revenueMtd: +revenueMtd.toFixed(2),
      revenueYtd: +revenueYtd.toFixed(2),
      collectedMtd: +collectedMtd.toFixed(2),
    },
    receivables: {
      outstanding: +arOutstanding.toFixed(2),
      overdue: +arOverdue.toFixed(2),
      overdueInvoiceCount,
    },
    payables: {
      outstanding: +apOutstanding.toFixed(2),
      invoiceCount: apInvoiceCount,
      expensesMtd: +Number(expensesMtd).toFixed(2),
    },
    projects: {
      active: activeProjects,
      overdue: overdueProjects,
      completed: completedProjects,
      byStage: Array.from(projectsByStage.entries()).map(([stage, count]) => ({ stage, count })),
    },
    service: {
      openTickets,
      criticalOpenTickets,
    },
    sales: {
      pipelineValue: +Number(pipe.pipelineValue).toFixed(2),
      activeLeads: pipe.activeLeads,
      pendingApprovals,
    },
    topCustomers,
    cashFlowTrend: trendSeries,
    alerts: {
      overdueInvoices: overdueInvoices.map(o => ({
        invoiceNumber: o.invoiceNumber,
        accountName: o.accountName ?? "Unknown",
        dueDate: o.dueDate,
        balance: +Number(o.balance).toFixed(2),
      })),
      blockedProjects: projectsBlocked.map(p => ({
        projectNumber: p.projectNumber,
        name: p.name,
        expectedEndDate: p.expectedEndDate,
        stage: p.stage,
      })),
    },
  });
});

export default router;

import { Link } from "wouter";
import { useGetManagementDashboard, useGetRecentActivity, getGetManagementDashboardQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/format";
import {
  TrendingUp, IndianRupee, AlertTriangle, Wallet, HardHat, Wrench,
  CheckSquare, Activity, ArrowRight, ReceiptText, Clock, Users,
} from "lucide-react";
import {
  Area, AreaChart, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const STAGE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function fmtCompactINR(value: number): string {
  if (Math.abs(value) >= 1_00_00_000) return `\u20B9${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1_00_000) return `\u20B9${(value / 1_00_000).toFixed(2)} L`;
  if (Math.abs(value) >= 1_000) return `\u20B9${(value / 1_000).toFixed(1)} K`;
  return `\u20B9${value.toFixed(0)}`;
}

export default function Dashboard() {
  const { data, isLoading, isError } = useGetManagementDashboard({
    query: { queryKey: getGetManagementDashboardQueryKey(), refetchInterval: 60_000 },
  });
  const { data: recent, isLoading: loadingRecent } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-80 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Could not load the management dashboard. Please refresh.
        </CardContent>
      </Card>
    );
  }

  const cashCoverage = data.payables.outstanding > 0
    ? (data.receivables.outstanding / data.payables.outstanding) * 100
    : null;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Management Overview</h1>
          <p className="text-sm text-muted-foreground">
            Live snapshot of revenue, cash flow, projects and operations.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {formatDate(data.asOf)}
        </p>
      </header>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Revenue (this month)"
          value={fmtCompactINR(data.revenue.revenueMtd)}
          subline={`YTD ${fmtCompactINR(data.revenue.revenueYtd)}`}
          icon={TrendingUp}
          tone="primary"
          testId="kpi-revenue-mtd"
        />
        <Kpi
          label="Collected (this month)"
          value={fmtCompactINR(data.revenue.collectedMtd)}
          subline={`Pipeline ${fmtCompactINR(data.sales.pipelineValue)}`}
          icon={IndianRupee}
          tone="success"
          testId="kpi-collected-mtd"
        />
        <Kpi
          label="Receivables outstanding"
          value={fmtCompactINR(data.receivables.outstanding)}
          subline={
            data.receivables.overdue > 0
              ? `${fmtCompactINR(data.receivables.overdue)} overdue \u00B7 ${data.receivables.overdueInvoiceCount} invoices`
              : "Nothing overdue"
          }
          icon={ReceiptText}
          tone={data.receivables.overdue > 0 ? "warning" : "muted"}
          testId="kpi-ar-outstanding"
        />
        <Kpi
          label="Payables outstanding"
          value={fmtCompactINR(data.payables.outstanding)}
          subline={`Expenses MTD ${fmtCompactINR(data.payables.expensesMtd)}`}
          icon={Wallet}
          tone="muted"
          testId="kpi-ap-outstanding"
        />
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniKpi
          label="Active projects"
          value={data.projects.active}
          hint={data.projects.overdue > 0 ? `${data.projects.overdue} overdue` : "On schedule"}
          tone={data.projects.overdue > 0 ? "warning" : "muted"}
          icon={HardHat}
          href="/projects"
          testId="kpi-active-projects"
        />
        <MiniKpi
          label="Open service tickets"
          value={data.service.openTickets}
          hint={data.service.criticalOpenTickets > 0 ? `${data.service.criticalOpenTickets} critical` : "No critical"}
          tone={data.service.criticalOpenTickets > 0 ? "warning" : "muted"}
          icon={Wrench}
          href="/service-tickets"
          testId="kpi-open-tickets"
        />
        <MiniKpi
          label="Pending approvals"
          value={data.sales.pendingApprovals}
          hint={data.sales.pendingApprovals > 0 ? "Action needed" : "All clear"}
          tone={data.sales.pendingApprovals > 0 ? "warning" : "muted"}
          icon={CheckSquare}
          href="/approvals"
          testId="kpi-pending-approvals"
        />
        <MiniKpi
          label="Active leads"
          value={data.sales.activeLeads}
          hint={fmtCompactINR(data.sales.pipelineValue) + " pipeline"}
          tone="muted"
          icon={Users}
          href="/leads"
          testId="kpi-active-leads"
        />
      </div>

      {/* Cash flow trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Invoiced vs Collected</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Last 12 months</p>
          </div>
          {cashCoverage !== null && (
            <Badge variant={cashCoverage >= 100 ? "default" : "destructive"}>
              AR / AP ratio: {cashCoverage.toFixed(0)}%
            </Badge>
          )}
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.cashFlowTrend} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="invoicedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => fmtCompactINR(v)} tick={{ fontSize: 11 }} width={70} />
              <RechartsTooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#3b82f6" strokeWidth={2} fill="url(#invoicedFill)" />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" strokeWidth={2} fill="url(#collectedFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top customers + Project mix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top customers (last 12 months)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topCustomers.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No invoiced customers in the last 12 months.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((c) => (
                    <tr key={c.accountId} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/accounts/${c.accountId}`} className="font-medium hover:underline">
                          {c.accountName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtCompactINR(c.revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.outstanding > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{fmtCompactINR(c.outstanding)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active projects by stage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.projects.byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.projects.byStage}
                    dataKey="count"
                    nameKey="stage"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {data.projects.byStage.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: number, name: string) => [v, String(name).replace(/_/g, " ")]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => String(value).replace(/_/g, " ")}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Overdue invoices
            </CardTitle>
            <Link href="/financial/ageing">
              <Button variant="ghost" size="sm" className="gap-1">
                Ageing <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.alerts.overdueInvoices.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nothing overdue. Nice work.</p>
            ) : (
              <ul className="divide-y">
                {data.alerts.overdueInvoices.map((inv) => (
                  <li key={inv.invoiceNumber} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.accountName}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceNumber}
                        {inv.dueDate && ` \u00B7 due ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">
                      {fmtCompactINR(inv.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Projects past due date
            </CardTitle>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="gap-1">
                All projects <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.alerts.blockedProjects.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No projects past their target date.</p>
            ) : (
              <ul className="divide-y">
                {data.alerts.blockedProjects.map((p) => (
                  <li key={p.projectNumber} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.projectNumber} {"\u00B7"} {p.stage.replace(/_/g, " ")}
                      </p>
                    </div>
                    {p.expectedEndDate && (
                      <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                        target {formatDate(p.expectedEndDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline + Recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !recent || recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {recent.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.userName ?? "System"} {"\u00B7"} {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick stats</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { label: "Pipeline", value: data.sales.pipelineValue },
                  { label: "Receivables", value: data.receivables.outstanding },
                  { label: "Payables", value: data.payables.outstanding },
                ]}
                margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => fmtCompactINR(v)} tick={{ fontSize: 10 }} width={70} />
                <RechartsTooltip
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#3b82f6" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Stat label="Completed" value={data.projects.completed} />
              <Stat label="Active" value={data.projects.active} />
              <Stat label="Overdue" value={data.projects.overdue} tone={data.projects.overdue > 0 ? "warn" : undefined} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function toneClasses(tone: "primary" | "success" | "warning" | "muted" | undefined): { iconBg: string; iconText: string } {
  switch (tone) {
    case "primary": return { iconBg: "bg-primary/10", iconText: "text-primary" };
    case "success": return { iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-400" };
    case "warning": return { iconBg: "bg-amber-500/10", iconText: "text-amber-600 dark:text-amber-400" };
    default: return { iconBg: "bg-muted", iconText: "text-muted-foreground" };
  }
}

function Kpi({
  label, value, subline, icon: Icon, tone, testId,
}: {
  label: string;
  value: string | number;
  subline?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "muted";
  testId?: string;
}) {
  const t = toneClasses(tone);
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold">{value}</p>
            {subline && <p className="mt-1 truncate text-xs text-muted-foreground">{subline}</p>}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
            <Icon className={`h-4 w-4 ${t.iconText}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({
  label, value, hint, icon: Icon, tone, href, testId,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "muted";
  href: string;
  testId?: string;
}) {
  const t = toneClasses(tone);
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/40" data-testid={testId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{value.toLocaleString("en-IN")}</p>
              {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
            </div>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${t.iconBg}`}>
              <Icon className={`h-4 w-4 ${t.iconText}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <p className={`text-lg font-bold ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

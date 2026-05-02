import { useGetFinancialSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/format";
import { TrendingUp, AlertTriangle, IndianRupee, Receipt } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function FinancialDashboard() {
  const { data, isLoading } = useGetFinancialSummary();

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-12 w-1/2" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;
  }

  const kpis = [
    { label: "Total Invoiced", value: formatINR(data.totalInvoiced), icon: Receipt, accent: "text-blue-600", testId: "kpi-invoiced" },
    { label: "Total Collected", value: formatINR(data.totalCollected), icon: IndianRupee, accent: "text-green-600", testId: "kpi-collected" },
    { label: "Outstanding", value: formatINR(data.totalOutstanding), icon: TrendingUp, accent: "text-orange-600", testId: "kpi-outstanding" },
    { label: "Overdue", value: formatINR(data.totalOverdue), icon: AlertTriangle, accent: "text-red-600", testId: "kpi-overdue" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financial Dashboard</h1>
        <p className="text-muted-foreground">Overview of receivables and collections</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.accent}`} data-testid={k.testId}>{k.value}</p>
                </div>
                <k.icon className={`h-8 w-8 ${k.accent} opacity-30`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Draft</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold" data-testid="count-draft">{data.countDraft}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Sent</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600" data-testid="count-sent">{data.countSent}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Partially Paid</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-yellow-600" data-testid="count-pp">{data.countPartiallyPaid}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600" data-testid="count-paid">{data.countPaid}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Overdue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-red-600" data-testid="count-overdue">{data.countOverdue}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly Trend (Last 12 Months)</CardTitle></CardHeader>
        <CardContent className="h-80">
          {data.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Bar dataKey="invoiced" fill="#3b82f6" name="Invoiced" />
                <Bar dataKey="collected" fill="#10b981" name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

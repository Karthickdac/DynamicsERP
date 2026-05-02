import { useGetProcurementDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingBag, Truck, Wallet, AlertTriangle, IndianRupee, CheckCircle } from "lucide-react";
import { formatINR } from "@/lib/format";

function Stat({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
  return (
    <Card><CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader><CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent></Card>
  );
}

export default function ProcurementDashboard() {
  const { data, isLoading } = useGetProcurementDashboard();
  if (isLoading) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Procurement Dashboard</h1>
        <p className="text-muted-foreground">Spend, vendors, and expense overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total PO Value" value={formatINR(data.totalPoValue)} icon={ShoppingBag} hint={`${data.totalPoCount} active POs`} />
        <Stat label="Pending Approval" value={String(data.pendingApprovalCount)} icon={AlertTriangle} hint="Awaiting sign-off" />
        <Stat label="In Transit" value={formatINR(data.inTransitValue)} icon={Truck} hint="Sent / Partially received" />
        <Stat label="Vendor Payables" value={formatINR(data.vendorPayables)} icon={IndianRupee} hint="Outstanding to vendors" />
        <Stat label="Total Expenses" value={formatINR(data.expenseTotal)} icon={Wallet} hint="Submitted + Approved" />
        <Stat label="Pending Expenses" value={String(data.expensePendingCount)} icon={AlertTriangle} hint="Submitted, awaiting approval" />
        <Stat label="Approved Expenses" value={String(data.expenseApprovedCount)} icon={CheckCircle} hint="Approved or reimbursed" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top Vendors by Spend</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.topVendors.length === 0 ? <div className="p-6 text-center text-muted-foreground">No vendor activity.</div> : (
              <Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>POs</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>{data.topVendors.map(v => (
                  <TableRow key={v.vendorId}><TableCell>{v.vendorName}</TableCell><TableCell>{v.poCount}</TableCell><TableCell className="font-medium">{formatINR(v.totalValue)}</TableCell></TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.expenseByCategory.length === 0 ? <div className="p-6 text-center text-muted-foreground">No expenses yet.</div> : (
              <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>{data.expenseByCategory.map(c => (
                  <TableRow key={c.category}><TableCell className="capitalize">{c.category}</TableCell><TableCell className="font-medium">{formatINR(c.amount)}</TableCell></TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

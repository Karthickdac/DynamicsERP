import { useParams, Link } from "wouter";
import { useGetVendor, useListPurchaseOrders, useListVendorInvoices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, formatDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const vid = parseInt(id ?? "0", 10);
  const { data: vendor, isLoading } = useGetVendor(vid);
  const { data: pos } = useListPurchaseOrders({ vendorId: vid } as any);
  const { data: invoices } = useListVendorInvoices({ vendorId: vid } as any);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (!vendor) return <div>Vendor not found</div>;

  const outstanding = (invoices ?? []).reduce((sum, i) => i.status === "paid" ? sum : sum + (i.amount - i.paidAmount), 0);

  return (
    <div className="space-y-6">
      <Link href="/vendors"><Button variant="ghost" size="sm" data-testid="btn-back"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
      <div>
        <h1 className="text-3xl font-bold">{vendor.name}</h1>
        <p className="text-muted-foreground font-mono">{vendor.code}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total POs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pos?.length ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vendor Invoices</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{invoices?.length ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatINR(outstanding)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Vendor Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-muted-foreground">GSTIN</div><div className="font-mono">{vendor.gstin ?? "-"}</div></div>
          <div><div className="text-muted-foreground">PAN</div><div className="font-mono">{vendor.pan ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Category</div><div>{vendor.category ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Contact</div><div>{vendor.contactPerson ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Phone</div><div>{vendor.phone ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Email</div><div>{vendor.email ?? "-"}</div></div>
          <div><div className="text-muted-foreground">City</div><div>{vendor.city ?? "-"}</div></div>
          <div><div className="text-muted-foreground">State</div><div>{vendor.state ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Pincode</div><div>{vendor.pincode ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Bank</div><div>{vendor.bankName ?? "-"}</div></div>
          <div><div className="text-muted-foreground">A/c No</div><div className="font-mono">{vendor.bankAccountNo ?? "-"}</div></div>
          <div><div className="text-muted-foreground">IFSC</div><div className="font-mono">{vendor.ifscCode ?? "-"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          {pos && pos.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Title</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{pos.map(p => (
                <TableRow key={p.id}><TableCell><Link href={`/purchase-orders/${p.id}`} className="font-mono text-primary hover:underline">{p.poNumber}</Link></TableCell>
                  <TableCell>{p.title}</TableCell><TableCell>{formatDate(p.orderDate)}</TableCell>
                  <TableCell className="font-medium">{formatINR(p.total)}</TableCell><TableCell><Badge variant="outline">{p.status.replace(/_/g, " ")}</Badge></TableCell></TableRow>
              ))}</TableBody></Table>
          ) : <div className="p-6 text-center text-muted-foreground">No purchase orders yet.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendor Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          {invoices && invoices.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{invoices.map(i => (
                <TableRow key={i.id}><TableCell className="font-mono">{i.vendorInvoiceNumber}</TableCell>
                  <TableCell>{formatDate(i.invoiceDate)}</TableCell>
                  <TableCell className="font-medium">{formatINR(i.amount)}</TableCell>
                  <TableCell>{formatINR(i.paidAmount)}</TableCell>
                  <TableCell><Badge variant="outline">{i.status.replace(/_/g, " ")}</Badge></TableCell></TableRow>
              ))}</TableBody></Table>
          ) : <div className="p-6 text-center text-muted-foreground">No vendor invoices yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

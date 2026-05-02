import { useState } from "react";
import { useGetGstReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatINR, formatDate } from "@/lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function GstReport() {
  const now = new Date();
  const [type, setType] = useState<"gstr1" | "gstr3b" | "hsn">("gstr1");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useGetGstReport({ type, month, year });
  const years = [year - 1, year, year + 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">GST Reports</h1>
        <p className="text-muted-foreground">GSTR-1, GSTR-3B and HSN summaries for filing</p>
      </div>

      <Card>
        <CardContent className="p-4 flex items-end gap-4">
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-40" data-testid="select-month"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-32" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={type} onValueChange={(v) => setType(v as any)}>
        <TabsList>
          <TabsTrigger value="gstr1" data-testid="tab-gstr1">GSTR-1 (Outward)</TabsTrigger>
          <TabsTrigger value="gstr3b" data-testid="tab-gstr3b">GSTR-3B Summary</TabsTrigger>
          <TabsTrigger value="hsn" data-testid="tab-hsn">HSN Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="gstr1">
          <Card>
            <CardHeader><CardTitle>Outward Supplies — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading || !data ? <div className="p-4"><Skeleton className="h-24" /></div> : data.rows.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>GSTIN</TableHead><TableHead>POS</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{r.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(r.invoiceDate)}</TableCell>
                        <TableCell>{r.accountName ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.buyerGstin ?? "-"}</TableCell>
                        <TableCell>{r.placeOfSupply}</TableCell>
                        <TableCell className="text-right">{formatINR(r.taxableAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.cgstAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.sgstAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.igstAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-bold">Totals</TableCell>
                      <TableCell className="text-right font-bold">{formatINR(data.totals.taxableAmount)}</TableCell>
                      <TableCell className="text-right font-bold">{formatINR(data.totals.cgstAmount)}</TableCell>
                      <TableCell className="text-right font-bold">{formatINR(data.totals.sgstAmount)}</TableCell>
                      <TableCell className="text-right font-bold">{formatINR(data.totals.igstAmount)}</TableCell>
                      <TableCell className="text-right font-bold">{formatINR(data.totals.total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No invoices for this period.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gstr3b">
          <Card>
            <CardHeader><CardTitle>GSTR-3B Summary — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent>
              {isLoading || !data ? <Skeleton className="h-24" /> : (
                <div className="space-y-2 text-sm max-w-md">
                  <div className="flex justify-between border-b pb-2"><span>Total taxable supplies</span><span className="font-bold">{formatINR(data.totals.taxableAmount)}</span></div>
                  <div className="flex justify-between"><span>CGST payable</span><span className="font-medium">{formatINR(data.totals.cgstAmount)}</span></div>
                  <div className="flex justify-between"><span>SGST payable</span><span className="font-medium">{formatINR(data.totals.sgstAmount)}</span></div>
                  <div className="flex justify-between"><span>IGST payable</span><span className="font-medium">{formatINR(data.totals.igstAmount)}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-2 text-base font-bold"><span>Total Tax</span><span>{formatINR(data.totals.cgstAmount + data.totals.sgstAmount + data.totals.igstAmount)}</span></div>
                  <div className="flex justify-between text-base font-bold"><span>Total Invoice Value</span><span>{formatINR(data.totals.total)}</span></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hsn">
          <Card>
            <CardHeader><CardTitle>HSN Summary — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading || !data ? <div className="p-4"><Skeleton className="h-24" /></div> : data.hsnRows.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>HSN</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.hsnRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{r.hsnCode}</TableCell>
                        <TableCell>{r.description ?? "-"}</TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell className="text-right">{formatINR(r.taxableAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.cgstAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.sgstAmount)}</TableCell>
                        <TableCell className="text-right">{formatINR(r.igstAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No data for this period.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

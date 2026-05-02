import { useGetAgeingReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import { Link } from "wouter";

export default function AgeingReport() {
  const { data, isLoading } = useGetAgeingReport();
  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receivables Ageing</h1>
        <p className="text-muted-foreground">Outstanding amounts by customer aged from due date</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Ageing Buckets</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">0-30 days</TableHead>
                  <TableHead className="text-right">31-60 days</TableHead>
                  <TableHead className="text-right">61-90 days</TableHead>
                  <TableHead className="text-right">90+ days</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(r => (
                  <TableRow key={r.accountId} data-testid={`ageing-row-${r.accountId}`}>
                    <TableCell><Link href={`/accounts/${r.accountId}`} className="text-primary hover:underline">{r.accountName}</Link></TableCell>
                    <TableCell className="text-right">{formatINR(r.bucket0to30)}</TableCell>
                    <TableCell className="text-right">{formatINR(r.bucket31to60)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatINR(r.bucket61to90)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatINR(r.bucket90Plus)}</TableCell>
                    <TableCell className="text-right font-bold">{formatINR(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(data.totals.bucket0to30)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(data.totals.bucket31to60)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(data.totals.bucket61to90)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(data.totals.bucket90Plus)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(data.totals.total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No outstanding receivables.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

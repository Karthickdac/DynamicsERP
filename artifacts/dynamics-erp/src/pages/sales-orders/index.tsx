import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListSalesOrders,
  getListSalesOrdersQueryKey,
  SalesOrderStatus,
} from "@workspace/api-client-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_OPTIONS = ["confirmed", "in_production", "ready_to_ship", "delivered", "cancelled"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
    in_production: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
    ready_to_ship: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300",
    delivered: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  };
  return <Badge variant="outline" className={`capitalize ${map[status] ?? ""}`}>{status.replace("_", " ")}</Badge>;
}

export default function SalesOrders() {
  const [status, setStatus] = useState<string>("_all");
  const [, setLocation] = useLocation();

  const params = status !== "_all" ? { status } : {};
  const { data: orders, isLoading } = useListSalesOrders(params, {
    query: { queryKey: getListSalesOrdersQueryKey(params) },
  });

  return (
    <div className="space-y-6" data-testid="page-sales-orders">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Sales Orders</h1>
          <p className="text-muted-foreground">Track confirmed orders through delivery.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-48 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.length ? orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setLocation(`/sales-orders/${o.id}`)} data-testid={`row-order-${o.id}`}>
                    <TableCell className="font-mono text-xs text-primary">{o.orderNumber}</TableCell>
                    <TableCell className="font-medium">{o.title}</TableCell>
                    <TableCell>{o.accountName || "-"}</TableCell>
                    <TableCell>{statusBadge(o.status)}</TableCell>
                    <TableCell className="text-right">{formatINR(o.total)}</TableCell>
                    <TableCell>{formatDate(o.orderDate)}</TableCell>
                    <TableCell>{formatDate(o.expectedDeliveryDate)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sales orders.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

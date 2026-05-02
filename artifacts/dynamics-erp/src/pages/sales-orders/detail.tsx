import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSalesOrder,
  getGetSalesOrderQueryKey,
  useUpdateSalesOrder,
  getListSalesOrdersQueryKey,
  SalesOrderStatus,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { ShoppingCart, FileText } from "lucide-react";

const STATUSES = ["confirmed", "in_production", "ready_to_ship", "delivered", "cancelled"] as const;

export default function SalesOrderDetail() {
  const [, params] = useRoute("/sales-orders/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: order, isLoading } = useGetSalesOrder(id, {
    query: { enabled: !!id, queryKey: getGetSalesOrderQueryKey(id) },
  });

  const updateMutation = useUpdateSalesOrder();
  const [status, setStatus] = useState<string>("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setExpectedDelivery(order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split("T")[0] : "");
      setNotes(order.notes ?? "");
    }
  }, [order]);

  const onSave = () => {
    const payload: any = {
      status: status as SalesOrderStatus,
      expectedDeliveryDate: expectedDelivery ? new Date(expectedDelivery).toISOString() : null,
      notes: notes || null,
    };
    updateMutation.mutate({ id, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSalesOrderQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
        toast({ title: "Sales order updated" });
      },
    });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!order) return <div>Sales order not found</div>;

  return (
    <div className="space-y-6" data-testid="page-sales-order-detail">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> {order.title}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm">
          <span className="font-mono text-muted-foreground">{order.orderNumber}</span>
          <Badge variant="outline" className="capitalize">{order.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Account</p>
                <p className="font-medium">{order.accountName || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-medium text-primary">{formatINR(order.total)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-medium">{formatDate(order.orderDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Source Quotation</p>
                {order.quotationId ? (
                  <Link href={`/quotations/${order.quotationId}`} className="text-primary hover:underline font-medium flex items-center gap-1" data-testid="link-source-quotation">
                    <FileText className="w-4 h-4" /> View Quotation
                  </Link>
                ) : <p>-</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Update Order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-order-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} data-testid="input-expected-delivery" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[100px]" data-testid="input-order-notes" />
            </div>
            <Button onClick={onSave} disabled={updateMutation.isPending} className="w-full" data-testid="btn-save-order">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

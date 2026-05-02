import { useState } from "react";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPurchaseOrder, getGetPurchaseOrderQueryKey, getListPurchaseOrdersQueryKey,
  useAddPoLineItem, useDeletePoLineItem,
  useSubmitPurchaseOrder, useApprovePurchaseOrder, useRejectPurchaseOrder,
  useSendPurchaseOrder, useCancelPurchaseOrder,
  useListGrns, useCreateGrn, getListGrnsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Plus, Trash2, Send, CheckCircle, XCircle, Truck, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { PoStatusBadge } from "./index";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { PrintExportButtons } from "@/components/print-export-buttons";

const lineSchema = z.object({
  productName: z.string().min(2),
  hsnCode: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().default("nos"),
  unitPrice: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  gstRate: z.coerce.number().min(0).max(28).default(18),
});

const grnSchema = z.object({
  receivedDate: z.string().optional(),
  notes: z.string().optional(),
});

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const poId = parseInt(id ?? "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: po, isLoading } = useGetPurchaseOrder(poId);
  const { data: grns } = useListGrns({ purchaseOrderId: poId } as any);

  const addLineMutation = useAddPoLineItem();
  const deleteLineMutation = useDeletePoLineItem();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const rejectMutation = useRejectPurchaseOrder();
  const sendMutation = useSendPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const grnMutation = useCreateGrn();

  const [openLine, setOpenLine] = useState(false);
  const [openGrn, setOpenGrn] = useState(false);
  const [grnQty, setGrnQty] = useState<Record<number, string>>({});

  const lineForm = useForm<z.infer<typeof lineSchema>>({
    resolver: zodResolver(lineSchema),
    defaultValues: { productName: "", hsnCode: "", quantity: 1, unit: "nos", unitPrice: 0, discountPct: 0, gstRate: 18 },
  });
  const grnForm = useForm<z.infer<typeof grnSchema>>({
    resolver: zodResolver(grnSchema), defaultValues: { receivedDate: "", notes: "" },
  });

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (!po) return <div>Purchase order not found</div>;

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(poId) });
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGrnsQueryKey() });
  };

  const onAddLine = (v: z.infer<typeof lineSchema>) => {
    addLineMutation.mutate({ id: poId, data: {
      productName: v.productName, hsnCode: v.hsnCode || null,
      quantity: v.quantity, unit: v.unit || "nos", unitPrice: v.unitPrice,
      discountPct: v.discountPct ?? 0, gstRate: v.gstRate,
    } }, {
      onSuccess: () => { toast({ title: "Line added" }); refetch(); setOpenLine(false); lineForm.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const action = (mut: any, name: string, body: any = undefined) => {
    const arg = body !== undefined ? { id: poId, data: body } : { id: poId };
    mut.mutate(arg, {
      onSuccess: () => { toast({ title: name }); refetch(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "", variant: "destructive" }),
    });
  };

  const onCreateGrn = (v: z.infer<typeof grnSchema>) => {
    const lines = Object.entries(grnQty)
      .map(([poLineItemId, qty]) => ({ poLineItemId: parseInt(poLineItemId), quantity: parseFloat(qty || "0") }))
      .filter(l => l.quantity > 0);
    if (lines.length === 0) { toast({ title: "Enter at least one quantity to receive", variant: "destructive" }); return; }
    grnMutation.mutate({ data: { purchaseOrderId: poId, receivedDate: v.receivedDate || null, notes: v.notes || null, lines } }, {
      onSuccess: () => { toast({ title: "GRN recorded" }); refetch(); setOpenGrn(false); setGrnQty({}); grnForm.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const isDraft = po.status === "draft";
  const isPending = po.status === "pending_approval";
  const isApproved = po.status === "approved";
  const isSentLike = po.status === "sent" || po.status === "partially_received";
  const canAddLines = isDraft;
  const canCancel = !["received", "closed", "cancelled"].includes(po.status);

  return (
    <div className="space-y-6">
      <Link href="/purchase-orders"><Button variant="ghost" size="sm" data-testid="btn-back"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{po.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            <span className="font-mono">{po.poNumber}</span>
            <PoStatusBadge status={po.status} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PrintExportButtons
            title={`Purchase Order ${po.poNumber}`}
            subtitle={po.title ?? ""}
            filename={`po-${po.poNumber}`}
            showPrint
            meta={[
              { label: "Vendor", value: po.vendorName ?? "-" },
              { label: "Order Date", value: formatDate(po.orderDate) },
              { label: "Status", value: po.status },
            ]}
            columns={["#", "Item", "HSN", "Qty", "Unit", "Rate", "Disc%", "GST%", "Amount"]}
            rows={(po.lineItems ?? []).map((l: any, i: number) => [i + 1, l.productName, l.hsnCode ?? "", l.quantity, l.unit, formatINR(l.unitPrice), l.discountPct ?? 0, l.gstRate, formatINR(l.lineTotal)])}
            totals={[
              { label: "Subtotal", value: formatINR(po.subtotal) },
              { label: "GST", value: formatINR((po.cgstAmount ?? 0) + (po.sgstAmount ?? 0) + (po.igstAmount ?? 0)) },
              { label: "Total", value: formatINR(po.total) },
            ]}
          />
          <SendEmailDialog entityType="purchase_order" entityId={po.id} entityLabel={po.poNumber} category="procurement" />
          {isDraft && <Button onClick={() => action(submitMutation, "Submitted for approval")} data-testid="btn-submit-po"><Send className="mr-2 h-4 w-4" />Submit</Button>}
          {isPending && <>
            <Button onClick={() => action(approveMutation, "Approved")} data-testid="btn-approve-po"><CheckCircle className="mr-2 h-4 w-4" />Approve</Button>
            <Button variant="outline" onClick={() => action(rejectMutation, "Rejected", { reason: "Returned to draft" })} data-testid="btn-reject-po"><XCircle className="mr-2 h-4 w-4" />Reject</Button>
          </>}
          {isApproved && <Button onClick={() => action(sendMutation, "Sent to vendor")} data-testid="btn-send-po"><Send className="mr-2 h-4 w-4" />Send to Vendor</Button>}
          {(isApproved || isSentLike) && (
            <Dialog open={openGrn} onOpenChange={setOpenGrn}>
              <DialogTrigger asChild><Button variant="outline" data-testid="btn-record-grn"><Truck className="mr-2 h-4 w-4" />Record GRN</Button></DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Record Goods Receipt</DialogTitle></DialogHeader>
                <Form {...grnForm}>
                  <form onSubmit={grnForm.handleSubmit(onCreateGrn)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={grnForm.control} name="receivedDate" render={({ field }) => (<FormItem><FormLabel>Received Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Ordered</TableHead><TableHead>Already Received</TableHead><TableHead>Receive Now</TableHead></TableRow></TableHeader>
                      <TableBody>{po.lineItems.map(l => {
                        const remaining = l.quantity - l.receivedQuantity;
                        return (
                          <TableRow key={l.id}>
                            <TableCell>{l.productName}</TableCell>
                            <TableCell>{l.quantity} {l.unit}</TableCell>
                            <TableCell>{l.receivedQuantity}</TableCell>
                            <TableCell><Input type="number" step="0.001" min={0} max={remaining}
                              value={grnQty[l.id] ?? ""} onChange={e => setGrnQty(s => ({ ...s, [l.id]: e.target.value }))}
                              className="w-28" data-testid={`input-grn-qty-${l.id}`} /></TableCell>
                          </TableRow>
                        );
                      })}</TableBody>
                    </Table>
                    <DialogFooter><Button type="submit" disabled={grnMutation.isPending} data-testid="btn-submit-grn">Record GRN</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          {canCancel && <Button variant="ghost" onClick={() => action(cancelMutation, "Cancelled")} data-testid="btn-cancel-po">Cancel</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vendor</CardTitle></CardHeader><CardContent><Link href={`/vendors/${po.vendorId}`} className="text-primary hover:underline">{po.vendorName ?? "-"}</Link></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Order Date</CardTitle></CardHeader><CardContent>{formatDate(po.orderDate)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expected Delivery</CardTitle></CardHeader><CardContent>{formatDate(po.expectedDeliveryDate)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatINR(po.total)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          {canAddLines && (
            <Dialog open={openLine} onOpenChange={setOpenLine}>
              <DialogTrigger asChild><Button size="sm" data-testid="btn-add-line"><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Line Item</DialogTitle></DialogHeader>
                <Form {...lineForm}>
                  <form onSubmit={lineForm.handleSubmit(onAddLine)} className="space-y-3">
                    <FormField control={lineForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Product / Item</FormLabel><FormControl><Input {...field} data-testid="input-product-name" /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={lineForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Qty</FormLabel><FormControl><Input type="number" step="0.001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={lineForm.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                      <FormField control={lineForm.control} name="hsnCode" render={({ field }) => (<FormItem><FormLabel>HSN</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={lineForm.control} name="unitPrice" render={({ field }) => (<FormItem><FormLabel>Unit Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={lineForm.control} name="discountPct" render={({ field }) => (<FormItem><FormLabel>Discount %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                      <FormField control={lineForm.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel>GST %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                    </div>
                    <DialogFooter><Button type="submit" disabled={addLineMutation.isPending} data-testid="btn-submit-line">Add</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {po.lineItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No line items. Add items to build this PO.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>HSN</TableHead><TableHead>Qty</TableHead><TableHead>Received</TableHead>
                <TableHead>Unit Price</TableHead><TableHead>Disc %</TableHead><TableHead>GST %</TableHead>
                <TableHead>Total</TableHead>{canAddLines && <TableHead></TableHead>}
              </TableRow></TableHeader>
              <TableBody>{po.lineItems.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.productName}</TableCell><TableCell className="font-mono text-xs">{l.hsnCode ?? "-"}</TableCell>
                  <TableCell>{l.quantity} {l.unit}</TableCell><TableCell>{l.receivedQuantity}</TableCell>
                  <TableCell>{formatINR(l.unitPrice)}</TableCell><TableCell>{l.discountPct}%</TableCell>
                  <TableCell>{l.gstRate}%</TableCell><TableCell className="font-medium">{formatINR(l.lineTotal)}</TableCell>
                  {canAddLines && <TableCell><Button variant="ghost" size="icon" onClick={() => deleteLineMutation.mutate({ id: poId, itemId: l.id }, { onSuccess: refetch })} data-testid={`btn-delete-line-${l.id}`}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tax Summary ({po.supplyType === "intra" ? "Intra-state" : "Inter-state"} – {po.placeOfSupply})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(po.subtotal)}</span></div>
          {po.discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatINR(po.discountAmount)}</span></div>}
          <div className="flex justify-between"><span>Taxable</span><span>{formatINR(po.taxableAmount)}</span></div>
          {po.supplyType === "intra" ? <>
            <div className="flex justify-between"><span>CGST</span><span>{formatINR(po.cgstAmount)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span>{formatINR(po.sgstAmount)}</span></div>
          </> : <div className="flex justify-between"><span>IGST</span><span>{formatINR(po.igstAmount)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Grand Total</span><span>{formatINR(po.total)}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Goods Receipts</CardTitle></CardHeader>
        <CardContent className="p-0">
          {grns && grns.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>GRN #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>{grns.map(g => (
                <TableRow key={g.id}><TableCell className="font-mono">{g.grnNumber}</TableCell><TableCell>{formatDate(g.receivedDate)}</TableCell>
                  <TableCell><Badge status={g.status} /></TableCell><TableCell>{g.notes ?? "-"}</TableCell></TableRow>
              ))}</TableBody></Table>
          ) : <div className="p-6 text-center text-muted-foreground"><FileCheck className="mx-auto h-8 w-8 mb-2 opacity-50" />No receipts yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted">{status.replace(/_/g, " ")}</span>;
}

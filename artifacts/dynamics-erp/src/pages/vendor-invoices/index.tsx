import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVendorInvoices, getListVendorInvoicesQueryKey,
  useCreateVendorInvoice, useCreateVendorPayment,
  useListVendors, useListPurchaseOrders,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileSpreadsheet, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";

const createSchema = z.object({
  vendorInvoiceNumber: z.string().min(1),
  vendorId: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  amount: z.coerce.number().positive(),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const paySchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string().min(1),
  paymentMode: z.string().min(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export default function VendorInvoices() {
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: number; balance: number } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: invoices, isLoading } = useListVendorInvoices();
  const { data: vendors } = useListVendors({ isActive: true } as any);
  const { data: pos } = useListPurchaseOrders();
  const createMutation = useCreateVendorInvoice();
  const payMutation = useCreateVendorPayment();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { vendorInvoiceNumber: "", vendorId: "", purchaseOrderId: "_none", amount: 0, invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", notes: "" },
  });
  const payForm = useForm<z.infer<typeof paySchema>>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMode: "bank_transfer", referenceNumber: "", notes: "" },
  });

  const onCreate = (v: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: {
      vendorInvoiceNumber: v.vendorInvoiceNumber,
      vendorId: parseInt(v.vendorId),
      purchaseOrderId: v.purchaseOrderId && v.purchaseOrderId !== "_none" ? parseInt(v.purchaseOrderId) : null,
      amount: v.amount,
      invoiceDate: v.invoiceDate,
      dueDate: v.dueDate || null,
      notes: v.notes || null,
    } }, {
      onSuccess: () => { toast({ title: "Vendor invoice recorded" }); queryClient.invalidateQueries({ queryKey: getListVendorInvoicesQueryKey() }); setOpen(false); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const onPay = (v: z.infer<typeof paySchema>) => {
    if (!payTarget) return;
    payMutation.mutate({ data: {
      vendorInvoiceId: payTarget.id, amount: v.amount, paymentDate: v.paymentDate,
      paymentMode: v.paymentMode, referenceNumber: v.referenceNumber || null, notes: v.notes || null,
    } }, {
      onSuccess: () => { toast({ title: "Payment recorded" }); queryClient.invalidateQueries({ queryKey: getListVendorInvoicesQueryKey() }); setPayTarget(null); payForm.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const filteredPos = (pos ?? []).filter(p => {
    const vid = form.watch("vendorId");
    return vid && p.vendorId === parseInt(vid);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Invoices</h1>
          <p className="text-muted-foreground">Bills received from suppliers, with payments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="btn-new-vinv"><Plus className="mr-2 h-4 w-4" />Record Invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Vendor Invoice</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <FormField control={form.control} name="vendorId" render={({ field }) => (
                  <FormItem><FormLabel>Vendor</FormLabel>
                    <Select onValueChange={(val) => { field.onChange(val); form.setValue("purchaseOrderId", "_none"); }} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                      <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchaseOrderId" render={({ field }) => (
                  <FormItem><FormLabel>Purchase Order (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-po"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {filteredPos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.poNumber} — {p.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="vendorInvoiceNumber" render={({ field }) => (<FormItem><FormLabel>Vendor Invoice #</FormLabel><FormControl><Input {...field} data-testid="input-vinv-num" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-amount" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="invoiceDate" render={({ field }) => (<FormItem><FormLabel>Invoice Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                <DialogFooter><Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-vinv">Record</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          : invoices && invoices.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice #</TableHead><TableHead>Vendor</TableHead><TableHead>PO</TableHead><TableHead>Date</TableHead>
                <TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>{invoices.map(i => {
                const balance = i.amount - i.paidAmount;
                return (
                  <TableRow key={i.id} data-testid={`row-vinv-${i.id}`}>
                    <TableCell className="font-mono">{i.vendorInvoiceNumber}</TableCell>
                    <TableCell>{i.vendorName ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{i.poNumber ?? "-"}</TableCell>
                    <TableCell>{formatDate(i.invoiceDate)}</TableCell>
                    <TableCell className="font-medium">{formatINR(i.amount)}</TableCell>
                    <TableCell>{formatINR(i.paidAmount)}</TableCell>
                    <TableCell className="font-medium">{formatINR(balance)}</TableCell>
                    <TableCell><Badge variant="outline">{i.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{i.status !== "paid" && <Button size="sm" variant="outline" onClick={() => { setPayTarget({ id: i.id, balance }); payForm.setValue("amount", balance); }} data-testid={`btn-pay-${i.id}`}><IndianRupee className="h-4 w-4 mr-1" />Pay</Button>}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <FileSpreadsheet className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No vendor invoices recorded.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment (Balance: {formatINR(payTarget?.balance ?? 0)})</DialogTitle></DialogHeader>
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(onPay)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={payForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-pay-amount" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={payForm.control} name="paymentDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={payForm.control} name="paymentMode" render={({ field }) => (
                <FormItem><FormLabel>Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-mode"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="rtgs">RTGS</SelectItem>
                      <SelectItem value="neft">NEFT</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={payForm.control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
              <FormField control={payForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
              <DialogFooter><Button type="submit" disabled={payMutation.isPending} data-testid="btn-submit-payment">Record Payment</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

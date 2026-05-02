import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoice,
  getGetInvoiceQueryKey,
  useUpdateInvoice,
  useAddInvoiceLineItem,
  useUpdateInvoiceLineItem,
  useDeleteInvoiceLineItem,
  useSendInvoice,
  useCancelInvoice,
  useCreatePayment,
  useDeletePayment,
  useCreateCreditNote,
  useCancelCreditNote,
  useListProducts,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { Send, Ban, Plus, Receipt, Trash2, AlertCircle } from "lucide-react";
import { InvoiceStatusBadge } from "./index";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { PrintExportButtons } from "@/components/print-export-buttons";

const lineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Required"),
  description: z.string().optional(),
  hsnCode: z.string().optional(),
  quantity: z.coerce.number().positive("Must be > 0"),
  unit: z.string().default("nos"),
  unitPrice: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.coerce.number().min(0).max(100),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Must be > 0"),
  paymentDate: z.string().min(1, "Required"),
  paymentMode: z.string().min(1, "Required"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const cnSchema = z.object({
  amount: z.coerce.number().positive("Must be > 0"),
  reason: z.string().min(2, "Required"),
  issueDate: z.string().optional(),
  notes: z.string().optional(),
});

const PAYMENT_MODES = ["cash", "cheque", "bank_transfer", "upi", "card", "neft", "rtgs", "other"];

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openLine, setOpenLine] = useState(false);
  const [editingLine, setEditingLine] = useState<any | null>(null);
  const [openPay, setOpenPay] = useState(false);
  const [openCn, setOpenCn] = useState(false);

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) },
  });
  const { data: products } = useListProducts();

  const addLineMutation = useAddInvoiceLineItem();
  const updateLineMutation = useUpdateInvoiceLineItem();
  const deleteLineMutation = useDeleteInvoiceLineItem();
  const sendMutation = useSendInvoice();
  const cancelMutation = useCancelInvoice();
  const updateMutation = useUpdateInvoice();
  const createPaymentMutation = useCreatePayment();
  const deletePaymentMutation = useDeletePayment();
  const createCnMutation = useCreateCreditNote();
  const cancelCnMutation = useCancelCreditNote();

  const lineForm = useForm<z.infer<typeof lineSchema>>({
    resolver: zodResolver(lineSchema),
    defaultValues: { productId: "_none", productName: "", description: "", hsnCode: "", quantity: 1, unit: "nos", unitPrice: 0, discountPct: 0, gstRate: 18 },
  });
  const payForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMode: "bank_transfer", referenceNumber: "", notes: "" },
  });
  const cnForm = useForm<z.infer<typeof cnSchema>>({
    resolver: zodResolver(cnSchema),
    defaultValues: { amount: 0, reason: "", issueDate: new Date().toISOString().slice(0, 10), notes: "" },
  });

  if (isLoading || !invoice) return <div className="space-y-3"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64 w-full" /></div>;

  const isDraft = invoice.status === "draft";
  const canEdit = isDraft;
  const canSend = isDraft;
  const canCancel = invoice.status !== "paid" && invoice.status !== "cancelled";
  const canRecordPayment = invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "overdue";
  const canIssueCn = canRecordPayment;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
  };

  const onSaveLine = (values: z.infer<typeof lineSchema>) => {
    const payload = {
      productId: values.productId && values.productId !== "_none" ? parseInt(values.productId) : null,
      productName: values.productName,
      description: values.description || null,
      hsnCode: values.hsnCode || null,
      quantity: values.quantity,
      unit: values.unit,
      unitPrice: values.unitPrice,
      discountPct: values.discountPct,
      gstRate: values.gstRate,
    };
    const onDone = () => {
      toast({ title: editingLine ? "Item updated" : "Item added" });
      refresh();
      setOpenLine(false);
      setEditingLine(null);
      lineForm.reset();
    };
    const onErr = (err: any) => toast({ title: "Failed", description: err?.message ?? "", variant: "destructive" });
    if (editingLine) {
      updateLineMutation.mutate(
        { id, itemId: editingLine.id, data: { ...payload, position: editingLine.position } },
        { onSuccess: onDone, onError: onErr },
      );
    } else {
      addLineMutation.mutate(
        { id, data: { ...payload, position: (invoice.lineItems?.length ?? 0) + 1 } as any },
        { onSuccess: onDone, onError: onErr },
      );
    }
  };

  const openLineForEdit = (it: any) => {
    setEditingLine(it);
    lineForm.reset({
      productId: it.productId ? String(it.productId) : "_none",
      productName: it.productName,
      description: it.description ?? "",
      hsnCode: it.hsnCode ?? "",
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPrice: Number(it.unitPrice),
      discountPct: Number(it.discountPct),
      gstRate: Number(it.gstRate),
    });
    setOpenLine(true);
  };

  const openLineForCreate = () => {
    setEditingLine(null);
    lineForm.reset({ productId: "_none", productName: "", description: "", hsnCode: "", quantity: 1, unit: "nos", unitPrice: 0, discountPct: 0, gstRate: 18 });
    setOpenLine(true);
  };

  const onProductChange = (val: string) => {
    lineForm.setValue("productId", val);
    if (val !== "_none") {
      const p = products?.find(x => String(x.id) === val);
      if (p) {
        lineForm.setValue("productName", p.name);
        lineForm.setValue("hsnCode", p.hsnCode ?? "");
        lineForm.setValue("unit", p.unit ?? "nos");
        lineForm.setValue("unitPrice", Number(p.unitPrice));
        lineForm.setValue("gstRate", Number(p.gstRate));
      }
    }
  };

  const onDeleteLine = (itemId: number) => {
    if (!confirm("Delete this line item?")) return;
    deleteLineMutation.mutate({ id, itemId }, { onSuccess: () => { toast({ title: "Deleted" }); refresh(); } });
  };

  const onSend = () => sendMutation.mutate({ id }, {
    onSuccess: () => { toast({ title: "Invoice sent" }); refresh(); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "", variant: "destructive" }),
  });
  const onCancel = () => {
    if (!confirm("Cancel this invoice?")) return;
    cancelMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Invoice cancelled" }); refresh(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "", variant: "destructive" }),
    });
  };

  const onSavePayment = (values: z.infer<typeof paymentSchema>) => {
    createPaymentMutation.mutate(
      { data: { invoiceId: id, ...values } },
      {
        onSuccess: () => { toast({ title: "Payment recorded" }); refresh(); setOpenPay(false); payForm.reset({ amount: 0, paymentDate: new Date().toISOString().slice(0, 10), paymentMode: "bank_transfer", referenceNumber: "", notes: "" }); },
        onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "", variant: "destructive" }),
      },
    );
  };

  const onDeletePayment = (pid: number) => {
    if (!confirm("Delete this payment?")) return;
    deletePaymentMutation.mutate({ id: pid }, { onSuccess: () => { toast({ title: "Deleted" }); refresh(); } });
  };

  const onSaveCn = (values: z.infer<typeof cnSchema>) => {
    createCnMutation.mutate(
      { data: { invoiceId: id, ...values } },
      {
        onSuccess: () => { toast({ title: "Credit note issued" }); refresh(); setOpenCn(false); cnForm.reset({ amount: 0, reason: "", issueDate: new Date().toISOString().slice(0, 10), notes: "" }); },
        onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "", variant: "destructive" }),
      },
    );
  };

  const onCancelCn = (cnId: number) => {
    if (!confirm("Cancel this credit note?")) return;
    cancelCnMutation.mutate({ id: cnId }, { onSuccess: () => { toast({ title: "Cancelled" }); refresh(); } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-mono" data-testid="text-invoice-number">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.invoiceType === "proforma" && <span className="text-xs px-2 py-0.5 rounded bg-muted">PROFORMA</span>}
          </div>
          <p className="text-muted-foreground mt-1">{invoice.title}</p>
          {invoice.accountName && <p className="text-sm">For: <Link href={`/accounts/${invoice.accountId}`} className="text-primary hover:underline">{invoice.accountName}</Link></p>}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PrintExportButtons
            title={`Invoice ${invoice.invoiceNumber}`}
            subtitle={invoice.title ?? ""}
            filename={`invoice-${invoice.invoiceNumber}`}
            showPrint
            meta={[
              { label: "Customer", value: invoice.accountName ?? "-" },
              { label: "Invoice Date", value: formatDate(invoice.invoiceDate) },
              { label: "Due Date", value: formatDate(invoice.dueDate) },
              { label: "Status", value: invoice.status },
            ]}
            columns={["#", "Item", "HSN", "Qty", "Unit", "Rate", "Disc%", "GST%", "Amount"]}
            rows={(invoice.lineItems ?? []).map((l: any, i: number) => [i + 1, l.productName, l.hsnCode ?? "", l.quantity, l.unit, formatINR(l.unitPrice), l.discountPct ?? 0, l.gstRate, formatINR(l.lineTotal)])}
            totals={[
              { label: "Subtotal", value: formatINR(invoice.subtotal) },
              { label: "GST", value: formatINR((invoice.cgstAmount ?? 0) + (invoice.sgstAmount ?? 0) + (invoice.igstAmount ?? 0)) },
              { label: "Total", value: formatINR(invoice.total) },
              { label: "Paid", value: formatINR(invoice.paidAmount) },
              { label: "Balance Due", value: formatINR(invoice.balanceDue) },
            ]}
          />
          <SendEmailDialog entityType="invoice" entityId={invoice.id} entityLabel={invoice.invoiceNumber} category="billing" />
          {canSend && <Button onClick={onSend} disabled={sendMutation.isPending} data-testid="btn-send"><Send className="mr-2 h-4 w-4" />Send</Button>}
          {canCancel && <Button variant="outline" onClick={onCancel} disabled={cancelMutation.isPending} data-testid="btn-cancel-invoice"><Ban className="mr-2 h-4 w-4" />Cancel</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold" data-testid="text-total">{formatINR(invoice.total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold text-green-600">{formatINR(invoice.paidAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Balance Due</p><p className="text-2xl font-bold text-orange-600" data-testid="text-balance">{formatINR(invoice.balanceDue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Due Date</p><p className="text-lg font-medium">{formatDate(invoice.dueDate)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" data-testid="tab-items">Line Items</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments ({invoice.payments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="credit-notes" data-testid="tab-cn">Credit Notes ({invoice.creditNotes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="info">Invoice Info</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Line Items</CardTitle>
              {canEdit && (
                <Dialog open={openLine} onOpenChange={(o) => { setOpenLine(o); if (!o) setEditingLine(null); }}>
                  <DialogTrigger asChild><Button size="sm" onClick={openLineForCreate} data-testid="btn-add-line"><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{editingLine ? "Edit Line Item" : "Add Line Item"}</DialogTitle></DialogHeader>
                    <Form {...lineForm}>
                      <form onSubmit={lineForm.handleSubmit(onSaveLine)} className="space-y-3">
                        <FormField control={lineForm.control} name="productId" render={({ field }) => (
                          <FormItem><FormLabel>Product (optional)</FormLabel>
                            <Select onValueChange={onProductChange} value={field.value}>
                              <FormControl><SelectTrigger data-testid="select-product"><SelectValue placeholder="Pick from catalog" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="_none">— Manual entry —</SelectItem>
                                {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={lineForm.control} name="productName" render={({ field }) => (
                          <FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field} data-testid="input-line-name" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={lineForm.control} name="description" render={({ field }) => (
                          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
                        )} />
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={lineForm.control} name="hsnCode" render={({ field }) => (
                            <FormItem><FormLabel>HSN Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={lineForm.control} name="quantity" render={({ field }) => (
                            <FormItem><FormLabel>Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-qty" /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={lineForm.control} name="unit" render={({ field }) => (
                            <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={lineForm.control} name="unitPrice" render={({ field }) => (
                            <FormItem><FormLabel>Unit Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-price" /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={lineForm.control} name="discountPct" render={({ field }) => (
                            <FormItem><FormLabel>Disc %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={lineForm.control} name="gstRate" render={({ field }) => (
                            <FormItem><FormLabel>GST %</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-gst" /></FormControl></FormItem>
                          )} />
                        </div>
                        <DialogFooter><Button type="submit" data-testid="btn-save-line">Save</Button></DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {invoice.lineItems && invoice.lineItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead><TableHead>HSN</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Disc%</TableHead><TableHead className="text-right">GST%</TableHead><TableHead className="text-right">Line Total</TableHead>{canEdit && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map(it => (
                      <TableRow key={it.id} data-testid={`row-line-${it.id}`}>
                        <TableCell>
                          <div className="font-medium">{it.productName}</div>
                          {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{it.hsnCode ?? "-"}</TableCell>
                        <TableCell className="text-right">{it.quantity} {it.unit}</TableCell>
                        <TableCell className="text-right">{formatINR(it.unitPrice)}</TableCell>
                        <TableCell className="text-right">{it.discountPct}%</TableCell>
                        <TableCell className="text-right">{it.gstRate}%</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(it.lineTotal)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openLineForEdit(it)}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => onDeleteLine(it.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No line items yet.</div>
              )}
              <div className="border-t p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(invoice.subtotal)}</span></div>
                {Number(invoice.discountAmount) > 0 && <div className="flex justify-between text-orange-600"><span>Discount</span><span>− {formatINR(invoice.discountAmount)}</span></div>}
                <div className="flex justify-between"><span>Taxable Amount</span><span>{formatINR(invoice.taxableAmount)}</span></div>
                {invoice.supplyType === "intra" ? (
                  <>
                    <div className="flex justify-between"><span>CGST</span><span>{formatINR(invoice.cgstAmount)}</span></div>
                    <div className="flex justify-between"><span>SGST</span><span>{formatINR(invoice.sgstAmount)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span>IGST</span><span>{formatINR(invoice.igstAmount)}</span></div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatINR(invoice.total)}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Payments</CardTitle>
              {canRecordPayment && (
                <Dialog open={openPay} onOpenChange={setOpenPay}>
                  <DialogTrigger asChild><Button size="sm" data-testid="btn-record-payment"><Receipt className="mr-2 h-4 w-4" />Record Payment</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                    <Form {...payForm}>
                      <form onSubmit={payForm.handleSubmit(onSavePayment)} className="space-y-3">
                        <FormField control={payForm.control} name="amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount (Balance: {formatINR(invoice.balanceDue)})</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-pay-amount" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={payForm.control} name="paymentDate" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={payForm.control} name="paymentMode" render={({ field }) => (
                            <FormItem><FormLabel>Mode</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger data-testid="select-mode"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ").toUpperCase()}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={payForm.control} name="referenceNumber" render={({ field }) => (
                          <FormItem><FormLabel>Reference No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={payForm.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter><Button type="submit" disabled={createPaymentMutation.isPending} data-testid="btn-save-payment">Save</Button></DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {invoice.payments && invoice.payments.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoice.payments.map(p => (
                      <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                        <TableCell className="font-mono">{p.paymentNumber}</TableCell>
                        <TableCell>{formatDate(p.paymentDate)}</TableCell>
                        <TableCell className="uppercase text-xs">{p.paymentMode.replace("_", " ")}</TableCell>
                        <TableCell>{p.referenceNumber ?? "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(p.amount)}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => onDeletePayment(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No payments recorded.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit-notes" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Credit Notes</CardTitle>
              {canIssueCn && (
                <Dialog open={openCn} onOpenChange={setOpenCn}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" data-testid="btn-issue-cn"><AlertCircle className="mr-2 h-4 w-4" />Issue Credit Note</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Issue Credit Note</DialogTitle></DialogHeader>
                    <Form {...cnForm}>
                      <form onSubmit={cnForm.handleSubmit(onSaveCn)} className="space-y-3">
                        <FormField control={cnForm.control} name="amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-cn-amount" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={cnForm.control} name="reason" render={({ field }) => (
                          <FormItem><FormLabel>Reason</FormLabel><FormControl><Input {...field} data-testid="input-cn-reason" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={cnForm.control} name="issueDate" render={({ field }) => (
                          <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={cnForm.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter><Button type="submit" disabled={createCnMutation.isPending} data-testid="btn-save-cn">Save</Button></DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {invoice.creditNotes && invoice.creditNotes.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>CN #</TableHead><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoice.creditNotes.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono">{c.creditNoteNumber}</TableCell>
                        <TableCell>{formatDate(c.issueDate)}</TableCell>
                        <TableCell>{c.reason}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(c.amount)}</TableCell>
                        <TableCell><span className="text-xs uppercase">{c.status}</span></TableCell>
                        <TableCell className="text-right">{c.status !== "cancelled" && <Button variant="ghost" size="sm" onClick={() => onCancelCn(c.id)}>Cancel</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No credit notes.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div><Label className="text-muted-foreground">Type</Label><p className="capitalize">{invoice.invoiceType} Invoice</p></div>
              <div><Label className="text-muted-foreground">Supply Type</Label><p className="capitalize">{invoice.supplyType === "intra" ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)"}</p></div>
              <div><Label className="text-muted-foreground">Place of Supply</Label><p>{invoice.placeOfSupply}</p></div>
              <div><Label className="text-muted-foreground">Buyer GSTIN</Label><p className="font-mono">{invoice.buyerGstin ?? "-"}</p></div>
              <div><Label className="text-muted-foreground">Invoice Date</Label><p>{formatDate(invoice.invoiceDate)}</p></div>
              <div><Label className="text-muted-foreground">Due Date</Label><p>{formatDate(invoice.dueDate)}</p></div>
              <div><Label className="text-muted-foreground">Created By</Label><p>{invoice.createdByName ?? "-"}</p></div>
              <div><Label className="text-muted-foreground">Sales Order</Label><p>{invoice.salesOrderNumber ? <Link href={`/sales-orders/${invoice.salesOrderId}`} className="text-primary hover:underline font-mono">{invoice.salesOrderNumber}</Link> : "-"}</p></div>
              {invoice.notes && <div className="col-span-2"><Label className="text-muted-foreground">Notes</Label><p className="whitespace-pre-wrap">{invoice.notes}</p></div>}
              {invoice.termsAndConditions && <div className="col-span-2"><Label className="text-muted-foreground">Terms</Label><p className="whitespace-pre-wrap text-xs">{invoice.termsAndConditions}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

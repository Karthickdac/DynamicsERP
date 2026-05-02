import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuotation,
  getGetQuotationQueryKey,
  useUpdateQuotation,
  useAddQuotationLineItem,
  useUpdateQuotationLineItem,
  useDeleteQuotationLineItem,
  useSubmitQuotation,
  useSendQuotation,
  useMarkQuotationWon,
  useMarkQuotationLost,
  useConvertQuotationToOrder,
  useApproveApprovalRequest,
  useRejectApprovalRequest,
  useListProducts,
  useListAccounts,
  useListContacts,
  useListLeads,
  Product,
  QuotationLineItem,
  ApprovalRequest,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import {
  Edit,
  Plus,
  Send,
  Check,
  X,
  Printer,
  ArrowRight,
  Trash2,
  Building2,
  UserCircle,
  Target,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { QuotationStatusBadge } from "./index";
import { useAuth } from "@/hooks/use-auth";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { PrintExportButtons } from "@/components/print-export-buttons";

const editSchema = z.object({
  title: z.string().min(1),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
});

const lineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0.01),
  unit: z.string().min(1),
  unitPrice: z.coerce.number().min(0),
  discountPct: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0),
});

export default function QuotationDetail() {
  const [, params] = useRoute("/quotations/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: quotation, isLoading } = useGetQuotation(id, {
    query: { enabled: !!id, queryKey: getGetQuotationQueryKey(id) },
  });

  const { data: products } = useListProducts();
  const { data: accounts } = useListAccounts();
  const { data: contacts } = useListContacts();
  const { data: leads } = useListLeads();

  const updateMutation = useUpdateQuotation();
  const addLineMutation = useAddQuotationLineItem();
  const updateLineMutation = useUpdateQuotationLineItem();
  const deleteLineMutation = useDeleteQuotationLineItem();
  const submitMutation = useSubmitQuotation();
  const sendMutation = useSendQuotation();
  const wonMutation = useMarkQuotationWon();
  const lostMutation = useMarkQuotationLost();
  const convertMutation = useConvertQuotationToOrder();
  const approveMutation = useApproveApprovalRequest();
  const rejectMutation = useRejectApprovalRequest();

  const [editOpen, setEditOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<QuotationLineItem | null>(null);
  const [actionRequest, setActionRequest] = useState<{ req: ApprovalRequest; type: "approve" | "reject" } | null>(null);
  const [comments, setComments] = useState("");

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: {
      title: quotation?.title || "",
      accountId: quotation?.accountId ? quotation.accountId.toString() : "_none",
      contactId: quotation?.contactId ? quotation.contactId.toString() : "_none",
      leadId: quotation?.leadId ? quotation.leadId.toString() : "_none",
      validUntil: quotation?.validUntil ? new Date(quotation.validUntil).toISOString().split("T")[0] : "",
      notes: quotation?.notes || "",
      termsAndConditions: quotation?.termsAndConditions || "",
      discountAmount: quotation?.discountAmount ?? 0,
    },
  });

  const lineForm = useForm<z.infer<typeof lineSchema>>({
    resolver: zodResolver(lineSchema),
    defaultValues: { productId: "_none", productName: "", description: "", quantity: 1, unit: "nos", unitPrice: 0, discountPct: 0, gstRate: 18 },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(id) });
  };

  const onEdit = (values: z.infer<typeof editSchema>) => {
    const payload: any = {
      title: values.title,
      accountId: values.accountId === "_none" || !values.accountId ? null : parseInt(values.accountId),
      contactId: values.contactId === "_none" || !values.contactId ? null : parseInt(values.contactId),
      leadId: values.leadId === "_none" || !values.leadId ? null : parseInt(values.leadId),
      validUntil: values.validUntil ? new Date(values.validUntil).toISOString() : null,
      notes: values.notes || null,
      termsAndConditions: values.termsAndConditions || null,
      discountAmount: values.discountAmount,
    };
    updateMutation.mutate({ id, data: payload }, {
      onSuccess: () => { invalidate(); setEditOpen(false); toast({ title: "Quotation updated" }); },
    });
  };

  const openAddLine = () => {
    setEditingLine(null);
    lineForm.reset({ productId: "_none", productName: "", description: "", quantity: 1, unit: "nos", unitPrice: 0, discountPct: 0, gstRate: 18 });
    setLineOpen(true);
  };

  const openEditLine = (li: QuotationLineItem) => {
    setEditingLine(li);
    lineForm.reset({
      productId: li.productId ? li.productId.toString() : "_none",
      productName: li.productName,
      description: li.description ?? "",
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: li.unitPrice,
      discountPct: li.discountPct,
      gstRate: li.gstRate,
    });
    setLineOpen(true);
  };

  const onProductSelect = (productId: string) => {
    lineForm.setValue("productId", productId);
    if (productId === "_none") return;
    const p = products?.find((x: Product) => x.id.toString() === productId);
    if (p) {
      lineForm.setValue("productName", p.name);
      lineForm.setValue("unit", p.unit);
      lineForm.setValue("unitPrice", p.unitPrice);
      lineForm.setValue("gstRate", p.gstRate);
    }
  };

  const onLineSubmit = (values: z.infer<typeof lineSchema>) => {
    const payload: any = {
      productId: values.productId === "_none" || !values.productId ? null : parseInt(values.productId),
      productName: values.productName,
      description: values.description || null,
      quantity: values.quantity,
      unit: values.unit,
      unitPrice: values.unitPrice,
      discountPct: values.discountPct,
      gstRate: values.gstRate,
    };
    if (editingLine) {
      updateLineMutation.mutate({ id, itemId: editingLine.id, data: payload }, {
        onSuccess: () => { invalidate(); setLineOpen(false); toast({ title: "Line item updated" }); },
      });
    } else {
      addLineMutation.mutate({ id, data: payload }, {
        onSuccess: () => { invalidate(); setLineOpen(false); toast({ title: "Line item added" }); },
      });
    }
  };

  const onDeleteLine = (itemId: number) => {
    deleteLineMutation.mutate({ id, itemId }, {
      onSuccess: () => { invalidate(); toast({ title: "Line item deleted" }); },
    });
  };

  const doStatusAction = (mut: any, label: string) => {
    mut.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: label }); },
    });
  };

  const doConvert = () => {
    convertMutation.mutate({ id }, {
      onSuccess: (order: any) => {
        toast({ title: "Sales order created" });
        setLocation(`/sales-orders/${order.id}`);
      },
    });
  };

  const submitApproval = () => {
    if (!actionRequest) return;
    const data = { comments: comments || null };
    const mut = actionRequest.type === "approve" ? approveMutation : rejectMutation;
    mut.mutate({ id: actionRequest.req.id, data }, {
      onSuccess: () => {
        invalidate();
        setActionRequest(null);
        setComments("");
        toast({ title: actionRequest.type === "approve" ? "Approved" : "Rejected" });
      },
    });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!quotation) return <div>Quotation not found</div>;

  const status = quotation.status;
  const canPrint = status !== "draft";
  const canActOnApproval = (req: ApprovalRequest) => {
    if (req.status !== "pending" || !user) return false;
    if (req.approverId && req.approverId === user.id) return true;
    if (!req.approverId && req.approverRole === user.role) return true;
    return false;
  };

  return (
    <div className="space-y-6" data-testid="page-quotation-detail">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{quotation.title}</h1>
            <span className="font-mono text-sm text-muted-foreground">{quotation.quotationNumber}</span>
            <QuotationStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Created {formatDate(quotation.createdAt)} {quotation.createdByName ? `by ${quotation.createdByName}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === "draft" && (
            <Button onClick={() => doStatusAction(submitMutation, "Submitted for approval")} disabled={submitMutation.isPending} data-testid="btn-submit-approval">
              <Send className="w-4 h-4 mr-2" /> Submit for Approval
            </Button>
          )}
          {status === "rejected" && (
            <Button onClick={() => doStatusAction(submitMutation, "Resubmitted")} disabled={submitMutation.isPending} data-testid="btn-resubmit">
              <Send className="w-4 h-4 mr-2" /> Resubmit
            </Button>
          )}
          {status === "approved" && (
            <Button onClick={() => doStatusAction(sendMutation, "Sent to customer")} disabled={sendMutation.isPending} data-testid="btn-send">
              <Send className="w-4 h-4 mr-2" /> Send to Customer
            </Button>
          )}
          {(status === "approved" || status === "sent") && (
            <>
              <Button variant="outline" onClick={() => doStatusAction(wonMutation, "Marked as won")} disabled={wonMutation.isPending} data-testid="btn-won">
                <Check className="w-4 h-4 mr-2" /> Mark Won
              </Button>
              <Button variant="outline" onClick={() => doStatusAction(lostMutation, "Marked as lost")} disabled={lostMutation.isPending} data-testid="btn-lost">
                <X className="w-4 h-4 mr-2" /> Mark Lost
              </Button>
              <Button variant="outline" onClick={doConvert} disabled={convertMutation.isPending} data-testid="btn-convert">
                <ArrowRight className="w-4 h-4 mr-2" /> Convert to Order
              </Button>
            </>
          )}
          {canPrint && (
            <Button variant="outline" onClick={() => window.open(`/quotations/${id}/print`, "_blank")} data-testid="btn-print">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          )}
          <PrintExportButtons
            title={`Quotation ${quotation.quotationNumber}`}
            subtitle={quotation.title ?? ""}
            filename={`quotation-${quotation.quotationNumber}`}
            meta={[
              { label: "Customer", value: quotation.accountName ?? "-" },
              { label: "Created", value: formatDate(quotation.createdAt) },
              { label: "Valid Until", value: quotation.validUntil ? formatDate(quotation.validUntil) : "-" },
              { label: "Status", value: status },
            ]}
            columns={["#", "Item", "Qty", "Unit", "Rate", "Disc%", "GST%", "Amount"]}
            rows={(quotation.lineItems ?? []).map((l: any, i: number) => [i + 1, l.productName, l.quantity, l.unit, formatINR(l.unitPrice), l.discountPct ?? 0, l.gstRate, formatINR(l.lineTotal)])}
            totals={[
              { label: "Subtotal", value: formatINR(quotation.subtotal) },
              { label: "GST", value: formatINR(quotation.gstAmount ?? 0) },
              { label: "Discount", value: formatINR(quotation.discountAmount ?? 0) },
              { label: "Total", value: formatINR(quotation.total) },
            ]}
          />
          <SendEmailDialog entityType="quotation" entityId={quotation.id} entityLabel={quotation.quotationNumber} category="sales" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="text-2xl font-bold">{formatINR(quotation.subtotal)}</p>
            {quotation.discountAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Discount: {formatINR(quotation.discountAmount)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">GST</p>
            <p className="text-2xl font-bold">{formatINR(quotation.gstAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">on {formatINR(quotation.taxableAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-primary">{formatINR(quotation.total)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="line-items" data-testid="tab-line-items">Line Items</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quotation Details</CardTitle>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="btn-edit-quotation"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Edit Quotation</DialogTitle></DialogHeader>
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
                      <FormField control={editForm.control} name="title" render={({ field }) => (
                        <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="accountId" render={({ field }) => (
                          <FormItem><FormLabel>Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          <FormMessage /></FormItem>
                        )} />
                        <FormField control={editForm.control} name="contactId" render={({ field }) => (
                          <FormItem><FormLabel>Contact</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {contacts?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          <FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="leadId" render={({ field }) => (
                          <FormItem><FormLabel>Lead</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {leads?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.title}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          <FormMessage /></FormItem>
                        )} />
                        <FormField control={editForm.control} name="validUntil" render={({ field }) => (
                          <FormItem><FormLabel>Valid Until</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={editForm.control} name="discountAmount" render={({ field }) => (
                        <FormItem><FormLabel>Discount (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editForm.control} name="notes" render={({ field }) => (
                        <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editForm.control} name="termsAndConditions" render={({ field }) => (
                        <FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="w-4 h-4" /> Account</p>
                  {quotation.accountId ? (
                    <Link href={`/accounts/${quotation.accountId}`} className="text-primary hover:underline font-medium">{quotation.accountName}</Link>
                  ) : <p>-</p>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><UserCircle className="w-4 h-4" /> Contact</p>
                  {quotation.contactId ? (
                    <Link href={`/contacts/${quotation.contactId}`} className="text-primary hover:underline font-medium">View Contact</Link>
                  ) : <p>-</p>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Target className="w-4 h-4" /> Lead</p>
                  {quotation.leadId ? (
                    <Link href={`/leads/${quotation.leadId}`} className="text-primary hover:underline font-medium">{quotation.leadTitle}</Link>
                  ) : <p>-</p>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{formatDate(quotation.validUntil)}</p>
                </div>
              </div>
              {quotation.notes && (<><Separator /><div><p className="text-sm text-muted-foreground mb-1">Notes</p><p className="whitespace-pre-wrap text-sm">{quotation.notes}</p></div></>)}
              {quotation.termsAndConditions && (<><Separator /><div><p className="text-sm text-muted-foreground mb-1">Terms & Conditions</p><p className="whitespace-pre-wrap text-sm">{quotation.termsAndConditions}</p></div></>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="line-items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Dialog open={lineOpen} onOpenChange={setLineOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddLine} data-testid="btn-add-line"><Plus className="w-4 h-4 mr-2" /> Add Line Item</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingLine ? "Edit Line Item" : "Add Line Item"}</DialogTitle></DialogHeader>
                  <Form {...lineForm}>
                    <form onSubmit={lineForm.handleSubmit(onLineSubmit)} className="space-y-4">
                      <FormField control={lineForm.control} name="productId" render={({ field }) => (
                        <FormItem><FormLabel>Product (optional)</FormLabel>
                          <Select onValueChange={onProductSelect} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select to autofill" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="_none">Free-form (no product)</SelectItem>
                              {products?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.sku} — {p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        <FormMessage /></FormItem>
                      )} />
                      <FormField control={lineForm.control} name="productName" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={lineForm.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={lineForm.control} name="quantity" render={({ field }) => (
                          <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={lineForm.control} name="unit" render={({ field }) => (
                          <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={lineForm.control} name="unitPrice" render={({ field }) => (
                          <FormItem><FormLabel>Unit Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={lineForm.control} name="discountPct" render={({ field }) => (
                          <FormItem><FormLabel>Discount %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={lineForm.control} name="gstRate" render={({ field }) => (
                          <FormItem><FormLabel>GST %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={addLineMutation.isPending || updateLineMutation.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.lineItems?.length ? quotation.lineItems.map(li => (
                    <TableRow key={li.id}>
                      <TableCell>
                        <div className="font-medium">{li.productName}</div>
                        {li.description && <div className="text-xs text-muted-foreground">{li.description}</div>}
                      </TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      <TableCell>{li.unit}</TableCell>
                      <TableCell className="text-right">{formatINR(li.unitPrice)}</TableCell>
                      <TableCell className="text-right">{li.discountPct}%</TableCell>
                      <TableCell className="text-right">{li.gstRate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(li.lineTotal)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditLine(li)} data-testid={`btn-edit-line-${li.id}`}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => onDeleteLine(li.id)} data-testid={`btn-delete-line-${li.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No line items yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
            <CardContent>
              {quotation.approvalRequests?.length ? (
                <div className="space-y-4">
                  {quotation.approvalRequests.map(req => {
                    const StatusIcon = req.status === "approved" ? CheckCircle : req.status === "rejected" ? XCircle : Clock;
                    const colorClass = req.status === "approved" ? "text-green-600" : req.status === "rejected" ? "text-red-600" : "text-yellow-600";
                    return (
                      <div key={req.id} className="flex gap-4 p-4 rounded-lg border">
                        <StatusIcon className={`w-5 h-5 mt-1 ${colorClass}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">Level {req.level}</Badge>
                            <span className="font-medium capitalize">{req.approverRole.replace("_", " ")}</span>
                            {req.approverName && <span className="text-sm text-muted-foreground">— {req.approverName}</span>}
                            <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{req.status}</Badge>
                          </div>
                          {req.ruleName && <p className="text-xs text-muted-foreground mt-1">Rule: {req.ruleName}</p>}
                          {req.comments && <p className="text-sm mt-2">{req.comments}</p>}
                          {req.actionedAt && <p className="text-xs text-muted-foreground mt-1">Actioned {formatDate(req.actionedAt)}</p>}
                          {canActOnApproval(req) && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={() => { setActionRequest({ req, type: "approve" }); setComments(""); }} data-testid={`btn-approve-${req.id}`}>
                                <Check className="w-4 h-4 mr-2" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setActionRequest({ req, type: "reject" }); setComments(""); }} data-testid={`btn-reject-${req.id}`}>
                                <X className="w-4 h-4 mr-2" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No approval requests. Submit the quotation to start the workflow.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!actionRequest} onOpenChange={(o) => !o && setActionRequest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionRequest?.type === "approve" ? "Approve" : "Reject"} Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} data-testid="input-comments" />
            <Button onClick={submitApproval} disabled={approveMutation.isPending || rejectMutation.isPending} className="w-full" data-testid="btn-submit-approval-action">
              Confirm {actionRequest?.type === "approve" ? "Approval" : "Rejection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

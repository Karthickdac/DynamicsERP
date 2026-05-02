import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInvoices,
  getListInvoicesQueryKey,
  useCreateInvoice,
  useListAccounts,
  useListSalesOrders,
  useCreateInvoiceFromSalesOrder,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";

export const INVOICE_STATUS_VARIANTS: Record<string, { variant: any; className: string; label: string }> = {
  draft: { variant: "secondary", className: "", label: "Draft" },
  sent: { variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300", label: "Sent" },
  partially_paid: { variant: "outline", className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Partially Paid" },
  paid: { variant: "outline", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300", label: "Paid" },
  overdue: { variant: "outline", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300", label: "Overdue" },
  cancelled: { variant: "secondary", className: "", label: "Cancelled" },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = INVOICE_STATUS_VARIANTS[status] ?? { variant: "outline" as const, className: "", label: status };
  return <Badge variant={cfg.variant} className={cfg.className} data-testid={`badge-status-${status}`}>{cfg.label}</Badge>;
}

const TABS = [
  { value: "_all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const createSchema = z.object({
  accountId: z.string().min(1, "Required"),
  title: z.string().min(2, "Required"),
  invoiceType: z.string().default("tax"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const fromSoSchema = z.object({
  salesOrderId: z.string().min(1, "Required"),
});

export default function Invoices() {
  const [tab, setTab] = useState("_all");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openFromSo, setOpenFromSo] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const status = tab === "_all" ? undefined : tab;
  const { data: invoices, isLoading } = useListInvoices(
    { ...(status ? { status } : {}), ...(search ? { search } : {}) } as any,
  );
  const { data: accounts } = useListAccounts();
  const { data: salesOrders } = useListSalesOrders();

  const createMutation = useCreateInvoice();
  const fromSoMutation = useCreateInvoiceFromSalesOrder();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { accountId: "", title: "", invoiceType: "tax", invoiceDate: "", dueDate: "", notes: "" },
  });
  const fromSoForm = useForm<z.infer<typeof fromSoSchema>>({
    resolver: zodResolver(fromSoSchema), defaultValues: { salesOrderId: "" },
  });

  const onCreate = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate(
      {
        data: {
          accountId: parseInt(values.accountId),
          title: values.title,
          invoiceType: values.invoiceType,
          invoiceDate: values.invoiceDate || undefined,
          dueDate: values.dueDate || undefined,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Invoice created" });
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          setOpenCreate(false);
          form.reset();
        },
        onError: (err: any) => toast({ title: "Failed", description: err?.message ?? "", variant: "destructive" }),
      },
    );
  };

  const onCreateFromSo = (values: z.infer<typeof fromSoSchema>) => {
    fromSoMutation.mutate(
      { salesOrderId: parseInt(values.salesOrderId) },
      {
        onSuccess: () => {
          toast({ title: "Invoice created from sales order" });
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          setOpenFromSo(false);
          fromSoForm.reset();
        },
        onError: (err: any) => toast({ title: "Failed", description: err?.message ?? "", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage tax invoices, proformas, and credit notes</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openFromSo} onOpenChange={setOpenFromSo}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-invoice-from-so"><FileText className="mr-2 h-4 w-4" />From Sales Order</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Invoice from Sales Order</DialogTitle></DialogHeader>
              <Form {...fromSoForm}>
                <form onSubmit={fromSoForm.handleSubmit(onCreateFromSo)} className="space-y-4">
                  <FormField control={fromSoForm.control} name="salesOrderId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Order</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-so"><SelectValue placeholder="Select sales order" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {salesOrders?.filter(so => so.status !== "cancelled").map(so => (
                            <SelectItem key={so.id} value={String(so.id)}>{so.orderNumber} — {so.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter><Button type="submit" disabled={fromSoMutation.isPending} data-testid="btn-submit-from-so">Create</Button></DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-invoice"><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-title" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-account"><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                        <SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="invoiceType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="tax">Tax Invoice</SelectItem>
                          <SelectItem value="proforma">Proforma Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                      <FormItem><FormLabel>Invoice Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                      <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                  )} />
                  <DialogFooter><Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-invoice">Create</Button></DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search by invoice number or title..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" data-testid="input-search" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map(t => <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : invoices && invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id} className="cursor-pointer" data-testid={`row-invoice-${inv.id}`}>
                    <TableCell><Link href={`/invoices/${inv.id}`} className="font-mono text-primary hover:underline">{inv.invoiceNumber}</Link></TableCell>
                    <TableCell>{inv.title}</TableCell>
                    <TableCell>{inv.accountName ?? "-"}</TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="font-medium">{formatINR(inv.total)}</TableCell>
                    <TableCell className="font-medium">{formatINR(inv.balanceDue)}</TableCell>
                    <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Receipt className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No invoices yet. Create one to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

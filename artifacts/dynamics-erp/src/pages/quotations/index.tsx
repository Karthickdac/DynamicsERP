import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListQuotations,
  getListQuotationsQueryKey,
  useCreateQuotation,
  useListAccounts,
  useListContacts,
  useListLeads,
  QuotationStatus,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";

export const QUOTATION_STATUS_VARIANTS: Record<string, { variant: any; className: string; label: string }> = {
  draft: { variant: "secondary", className: "", label: "Draft" },
  pending_approval: { variant: "outline", className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Pending Approval" },
  approved: { variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300", label: "Approved" },
  sent: { variant: "outline", className: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300", label: "Sent" },
  won: { variant: "outline", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300", label: "Won" },
  lost: { variant: "outline", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300", label: "Lost" },
  rejected: { variant: "outline", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300", label: "Rejected" },
  cancelled: { variant: "secondary", className: "", label: "Cancelled" },
};

export function QuotationStatusBadge({ status }: { status: string }) {
  const cfg = QUOTATION_STATUS_VARIANTS[status] ?? { variant: "outline" as const, className: "", label: status };
  return <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>;
}

const TABS = [
  { value: "_all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const createSchema = z.object({
  title: z.string().min(1),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

export default function Quotations() {
  const [tab, setTab] = useState<string>("_all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = tab !== "_all" ? { status: tab } : {};
  const { data: quotations, isLoading } = useListQuotations(params, {
    query: { queryKey: getListQuotationsQueryKey(params) },
  });

  const { data: accounts } = useListAccounts();
  const { data: contacts } = useListContacts();
  const { data: leads } = useListLeads();

  const createMutation = useCreateQuotation();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", accountId: "_none", contactId: "_none", leadId: "_none", validUntil: "", notes: "" },
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    const payload: any = {
      title: values.title,
      accountId: values.accountId === "_none" || !values.accountId ? null : parseInt(values.accountId),
      contactId: values.contactId === "_none" || !values.contactId ? null : parseInt(values.contactId),
      leadId: values.leadId === "_none" || !values.leadId ? null : parseInt(values.leadId),
      validUntil: values.validUntil ? new Date(values.validUntil).toISOString() : null,
      notes: values.notes || null,
      discountAmount: 0,
    };
    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Quotation created" });
      },
    });
  };

  return (
    <div className="space-y-6" data-testid="page-quotations">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> Quotations
          </h1>
          <p className="text-muted-foreground">Build, send and track customer quotations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-quotation"><Plus className="w-4 h-4 mr-2" /> New Quotation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Quotation</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-quotation-title" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem><FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="contactId" render={({ field }) => (
                    <FormItem><FormLabel>Contact</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {contacts?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="leadId" render={({ field }) => (
                    <FormItem><FormLabel>Lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {leads?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="validUntil" render={({ field }) => (
                    <FormItem><FormLabel>Valid Until</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create Quotation"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map(t => <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-48 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations?.length ? quotations.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/quotations/${q.id}`} className="text-primary hover:underline" data-testid={`link-quotation-${q.id}`}>
                        {q.quotationNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell>{q.accountName || "-"}</TableCell>
                    <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                    <TableCell className="text-right">{formatINR(q.total)}</TableCell>
                    <TableCell>{formatDate(q.validUntil)}</TableCell>
                    <TableCell>{formatDate(q.createdAt)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

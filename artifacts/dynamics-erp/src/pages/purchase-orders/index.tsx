import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPurchaseOrders, getListPurchaseOrdersQueryKey, useCreatePurchaseOrder,
  useListVendors, useListProjects,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";

export const PO_STATUS_VARIANTS: Record<string, { className: string; label: string }> = {
  draft: { className: "", label: "Draft" },
  pending_approval: { className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300", label: "Pending Approval" },
  approved: { className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300", label: "Approved" },
  sent: { className: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300", label: "Sent" },
  partially_received: { className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Partially Received" },
  received: { className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300", label: "Received" },
  closed: { className: "bg-gray-200 text-gray-800", label: "Closed" },
  cancelled: { className: "", label: "Cancelled" },
};

export function PoStatusBadge({ status }: { status: string }) {
  const cfg = PO_STATUS_VARIANTS[status] ?? { className: "", label: status };
  return <Badge variant="outline" className={cfg.className} data-testid={`badge-status-${status}`}>{cfg.label}</Badge>;
}

const TABS = [
  { value: "_all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "partially_received", label: "Partial" },
  { value: "received", label: "Received" },
];

const schema = z.object({
  vendorId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().min(2),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

export default function PurchaseOrders() {
  const [tab, setTab] = useState("_all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const status = tab === "_all" ? undefined : tab;
  const { data: pos, isLoading } = useListPurchaseOrders({ ...(status ? { status } : {}), ...(search ? { search } : {}) } as any);
  const { data: vendors } = useListVendors({ isActive: true } as any);
  const { data: projects } = useListProjects();
  const createMutation = useCreatePurchaseOrder();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { vendorId: "", projectId: "_none", title: "", orderDate: "", expectedDeliveryDate: "", notes: "" },
  });

  const onSubmit = (v: z.infer<typeof schema>) => {
    createMutation.mutate({
      data: {
        vendorId: parseInt(v.vendorId),
        projectId: v.projectId && v.projectId !== "_none" ? parseInt(v.projectId) : null,
        title: v.title,
        orderDate: v.orderDate || null,
        expectedDeliveryDate: v.expectedDeliveryDate || null,
        notes: v.notes || null,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Purchase order created" });
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setOpen(false); form.reset();
      },
      onError: (err: any) => toast({ title: "Failed", description: err?.message ?? "", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Vendor procurement with GST and approval workflow</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="btn-new-po"><Plus className="mr-2 h-4 w-4" />New PO</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-title" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vendorId" render={({ field }) => (
                  <FormItem><FormLabel>Vendor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                      <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.code})</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Project (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-project"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="orderDate" render={({ field }) => (<FormItem><FormLabel>Order Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="expectedDeliveryDate" render={({ field }) => (<FormItem><FormLabel>Expected Delivery</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                <DialogFooter><Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-po">Create</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search by PO number or title..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" data-testid="input-search" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{TABS.map(t => <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          : pos && pos.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>PO #</TableHead><TableHead>Title</TableHead><TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pos.map(p => (
                <TableRow key={p.id} data-testid={`row-po-${p.id}`}>
                  <TableCell><Link href={`/purchase-orders/${p.id}`} className="font-mono text-primary hover:underline">{p.poNumber}</Link></TableCell>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>{p.vendorName ?? "-"}</TableCell>
                  <TableCell>{formatDate(p.orderDate)}</TableCell>
                  <TableCell className="font-medium">{formatINR(p.total)}</TableCell>
                  <TableCell><PoStatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No purchase orders yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

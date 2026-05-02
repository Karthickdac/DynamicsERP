import { useListLeads, getListLeadsQueryKey, useCreateLead, useListAccounts, useListContacts, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, ListFilter, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

const PIPELINE_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const createLeadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  status: z.enum(PIPELINE_STAGES),
  source: z.enum(["website", "referral", "walk_in", "exhibition", "cold_call", "partner", "social_media", "other"]),
  capacityKwp: z.coerce.number().optional().or(z.literal("")),
  estimatedValue: z.coerce.number().optional().or(z.literal("")),
  expectedCloseDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useListLeads();
  const { data: accounts } = useListAccounts();
  const { data: contacts } = useListContacts();
  const { data: users } = useListUsers();

  const createMutation = useCreateLead();
  const form = useForm<z.infer<typeof createLeadSchema>>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { 
      title: "", 
      accountId: "_none", 
      contactId: "_none", 
      status: "new", 
      source: "website",
      capacityKwp: "",
      estimatedValue: "",
      assignedToId: "_none"
    },
  });

  const onSubmit = (values: z.infer<typeof createLeadSchema>) => {
    const payload: any = {
      ...values,
      accountId: values.accountId === "_none" || !values.accountId ? undefined : parseInt(values.accountId),
      contactId: values.contactId === "_none" || !values.contactId ? undefined : parseInt(values.contactId),
      assignedToId: values.assignedToId === "_none" || !values.assignedToId ? undefined : parseInt(values.assignedToId),
      capacityKwp: values.capacityKwp === "" ? undefined : Number(values.capacityKwp),
      estimatedValue: values.estimatedValue === "" ? undefined : Number(values.estimatedValue),
    };

    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Lead created successfully" });
      },
    });
  };

  const filteredLeads = leads?.filter(l => {
    if (statusFilter !== "_all" && l.status !== statusFilter) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="page-leads">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Manage your sales pipeline.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-lead"><Plus className="w-4 h-4 mr-2" /> New Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Lead</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Lead Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem><FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="contactId" render={({ field }) => (
                    <FormItem><FormLabel>Contact</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {contacts?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem><FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="walk_in">Walk-in</SelectItem>
                          <SelectItem value="exhibition">Exhibition</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="capacityKwp" render={({ field }) => (
                    <FormItem><FormLabel>Capacity (kWp)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                    <FormItem><FormLabel>Est. Value (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="expectedCloseDate" render={({ field }) => (
                    <FormItem><FormLabel>Expected Close</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="assignedToId" render={({ field }) => (
                    <FormItem><FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Unassigned</SelectItem>
                          {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Lead"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-[200px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kanban" data-testid="tab-kanban"><LayoutGrid className="w-4 h-4 mr-2" /> Kanban</TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table"><ListFilter className="w-4 h-4 mr-2" /> Table</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : view === "table" ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Account/Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Est. Value</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads?.length ? (
                filteredLeads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <Link href={`/leads/${lead.id}`} className="text-primary hover:underline">{lead.title}</Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.accountName && <div className="font-medium">{lead.accountName}</div>}
                      {lead.contactName && <div className="text-muted-foreground">{lead.contactName}</div>}
                      {(!lead.accountName && !lead.contactName) && "-"}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{lead.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{formatINR(lead.estimatedValue)}</TableCell>
                    <TableCell>{lead.assignedToName || "Unassigned"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-6">No leads found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start h-[calc(100vh-280px)]">
          {PIPELINE_STAGES.map(stage => {
            const stageLeads = filteredLeads?.filter(l => l.status === stage) || [];
            if (statusFilter !== "_all" && statusFilter !== stage) return null;
            return (
              <div key={stage} className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold capitalize">{stage.replace("_", " ")}</h3>
                  <Badge variant="outline">{stageLeads.length}</Badge>
                </div>
                <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                  {stageLeads.map(lead => (
                    <Card key={lead.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                      <Link href={`/leads/${lead.id}`} className="block">
                        <CardContent className="p-4 space-y-2">
                          <h4 className="font-medium text-sm leading-tight">{lead.title}</h4>
                          <div className="text-xs text-muted-foreground">
                            {lead.accountName || lead.contactName || "No contact"}
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2">
                            <span className="font-medium">{formatINR(lead.estimatedValue)}</span>
                            <span>{lead.capacityKwp ? `${lead.capacityKwp}kWp` : ""}</span>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && <div className="text-sm text-center text-muted-foreground py-4">No leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

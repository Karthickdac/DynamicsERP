import { useGetLead, getGetLeadQueryKey, useUpdateLead, useDeleteLead, useListLeadActivities, getListLeadActivitiesQueryKey, useCreateLeadActivity, useListAccounts, useListContacts, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit, Building2, UserCircle, Calendar, IndianRupee, Zap, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PIPELINE_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const editLeadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  status: z.enum(PIPELINE_STAGES),
  source: z.string(),
  capacityKwp: z.coerce.number().optional().or(z.literal("")),
  estimatedValue: z.coerce.number().optional().or(z.literal("")),
  expectedCloseDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

const activitySchema = z.object({
  type: z.enum(["note", "call", "email", "meeting"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional()
});

export default function LeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lead, isLoading: leadLoading } = useGetLead(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) }
  });

  const { data: activities, isLoading: actsLoading } = useListLeadActivities(leadId, {
    query: { enabled: !!leadId, queryKey: getListLeadActivitiesQueryKey(leadId) }
  });

  const { data: accounts } = useListAccounts();
  const { data: contacts } = useListContacts();
  const { data: users } = useListUsers();

  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useUpdateLead();
  const deleteMutation = useDeleteLead();
  const createActivityMutation = useCreateLeadActivity();

  const form = useForm<z.infer<typeof editLeadSchema>>({
    resolver: zodResolver(editLeadSchema),
    values: {
      title: lead?.title || "",
      accountId: lead?.accountId ? lead.accountId.toString() : "_none",
      contactId: lead?.contactId ? lead.contactId.toString() : "_none",
      status: (lead?.status as any) || "new",
      source: lead?.source || "website",
      capacityKwp: lead?.capacityKwp || "",
      estimatedValue: lead?.estimatedValue || "",
      expectedCloseDate: lead?.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split('T')[0] : "",
      assignedToId: lead?.assignedToId ? lead.assignedToId.toString() : "_none",
    }
  });

  const activityForm = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "note", title: "", description: "" }
  });

  const onEdit = (values: z.infer<typeof editLeadSchema>) => {
    const payload: any = {
      ...values,
      accountId: values.accountId === "_none" || !values.accountId ? undefined : parseInt(values.accountId),
      contactId: values.contactId === "_none" || !values.contactId ? undefined : parseInt(values.contactId),
      assignedToId: values.assignedToId === "_none" || !values.assignedToId ? undefined : parseInt(values.assignedToId),
      capacityKwp: values.capacityKwp === "" ? undefined : Number(values.capacityKwp),
      estimatedValue: values.estimatedValue === "" ? undefined : Number(values.estimatedValue),
      expectedCloseDate: values.expectedCloseDate ? new Date(values.expectedCloseDate).toISOString() : undefined
    };

    updateMutation.mutate({ id: leadId, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadActivitiesQueryKey(leadId) }); // Status change creates an activity implicitly on the backend
        setEditOpen(false);
        toast({ title: "Lead updated" });
      }
    });
  };

  const onDelete = () => {
    deleteMutation.mutate({ id: leadId } as any, {
      onSuccess: () => {
        toast({ title: "Lead deleted" });
        setLocation("/leads");
      }
    });
  };

  const onAddActivity = (values: z.infer<typeof activitySchema>) => {
    createActivityMutation.mutate({ leadId, data: values as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadActivitiesQueryKey(leadId) });
        activityForm.reset();
        toast({ title: "Activity added" });
      }
    });
  };

  const updateStatus = (newStatus: string) => {
    if (!lead) return;
    const payload: any = {
      title: lead.title,
      accountId: lead.accountId ?? null,
      contactId: lead.contactId ?? null,
      status: newStatus,
      source: lead.source,
      capacityKwp: lead.capacityKwp != null ? Number(lead.capacityKwp) : null,
      estimatedValue: lead.estimatedValue != null ? Number(lead.estimatedValue) : null,
      expectedCloseDate: lead.expectedCloseDate ?? null,
      assignedToId: lead.assignedToId ?? null,
      siteAddress: lead.siteAddress ?? null,
      siteCity: lead.siteCity ?? null,
      siteState: lead.siteState ?? null,
      notes: lead.notes ?? null,
    };
    updateMutation.mutate({ id: leadId, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadActivitiesQueryKey(leadId) });
        toast({ title: "Status updated" });
      }
    });
  };

  if (leadLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!lead) return <div>Lead not found</div>;

  return (
    <div className="space-y-6" data-testid="page-lead-detail">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{lead.title}</h1>
            <Badge variant="outline" className="capitalize">{lead.status.replace("_", " ")}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Zap className="w-4 h-4"/> <span className="font-medium text-foreground">{lead.capacityKwp || 0} kWp</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><IndianRupee className="w-4 h-4"/> <span className="font-medium text-foreground">{formatINR(lead.estimatedValue)}</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-4 h-4"/> <span className="font-medium text-foreground">{formatDate(lead.expectedCloseDate)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lead.status} onValueChange={updateStatus} disabled={updateMutation.isPending}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-edit-lead"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Lead</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEdit)} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Lead Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="accountId" render={({ field }) => (
                      <FormItem><FormLabel>Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="assignedToId" render={({ field }) => (
                      <FormItem><FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="_none">Unassigned</SelectItem>
                            {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
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
                  <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="btn-delete-lead"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...activityForm}>
                <form onSubmit={activityForm.handleSubmit(onAddActivity)} className="space-y-4 mb-8 bg-muted/30 p-4 rounded-lg border">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={activityForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="note">Note</SelectItem>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className="col-span-2">
                      <FormField control={activityForm.control} name="title" render={({ field }) => (
                        <FormItem><FormControl><Input placeholder="Activity title..." {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>
                  <FormField control={activityForm.control} name="description" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Details (optional)" className="min-h-[80px]" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createActivityMutation.isPending} size="sm">
                      {createActivityMutation.isPending ? "Adding..." : "Add Activity"}
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {actsLoading ? (
                  <div className="text-center py-4">Loading activities...</div>
                ) : activities?.length ? (
                  activities.map(act => (
                    <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm capitalize">{act.type.replace("_", " ")}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(act.createdAt)}</span>
                        </div>
                        <div className="text-sm font-medium mb-1">{act.title}</div>
                        {act.description && <div className="text-sm text-muted-foreground mt-2">{act.description}</div>}
                        {act.userName && <div className="text-xs text-muted-foreground mt-2 font-medium">By {act.userName}</div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No activities recorded yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Related Entities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2"><Building2 className="w-4 h-4"/> Account</h4>
                {lead.accountId ? (
                  <Link href={`/accounts/${lead.accountId}`} className="text-primary hover:underline font-medium block">
                    {lead.accountName}
                  </Link>
                ) : <span className="text-sm text-muted-foreground">No account linked</span>}
              </div>
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2"><UserCircle className="w-4 h-4"/> Contact</h4>
                {lead.contactId ? (
                  <Link href={`/contacts/${lead.contactId}`} className="text-primary hover:underline font-medium block">
                    {lead.contactName}
                  </Link>
                ) : <span className="text-sm text-muted-foreground">No contact linked</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListServiceTickets, getListServiceTicketsQueryKey,
  useCreateServiceTicket,
  useListAccounts, useListUsers, useListProjects,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { Wrench, Plus, Search } from "lucide-react";

const STATUS_OPTIONS = ["open", "assigned", "in_progress", "resolved", "closed", "cancelled"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
    assigned: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300",
    in_progress: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
    resolved: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
    closed: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  };
  return <Badge variant="outline" className={`capitalize ${map[status] ?? ""}`}>{status.replace("_", " ")}</Badge>;
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    low: "bg-gray-100 text-gray-700 border-gray-300",
    medium: "bg-blue-100 text-blue-700 border-blue-300",
    high: "bg-orange-100 text-orange-700 border-orange-300",
    urgent: "bg-red-100 text-red-700 border-red-300",
  };
  return <Badge variant="outline" className={`capitalize ${map[p] ?? ""}`}>{p}</Badge>;
}

export default function ServiceTickets() {
  const [status, setStatus] = useState("_all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, string> = {};
  if (status !== "_all") params.status = status;
  if (search) params.search = search;
  const { data: tickets, isLoading } = useListServiceTickets(params, {
    query: { queryKey: getListServiceTicketsQueryKey(params) },
  });

  const { data: accounts } = useListAccounts();
  const { data: users } = useListUsers();
  const { data: projects } = useListProjects();

  const [form, setForm] = useState({
    subject: "", description: "", category: "complaint", priority: "medium",
    accountId: "_none", projectId: "_none", assigneeId: "_none",
    reportedAt: new Date().toISOString().slice(0, 10),
  });

  const createMutation = useCreateServiceTicket();
  const onCreate = () => {
    if (!form.subject) { toast({ title: "Subject required", variant: "destructive" }); return; }
    createMutation.mutate({
      data: {
        subject: form.subject,
        description: form.description || null,
        category: form.category,
        priority: form.priority,
        accountId: form.accountId !== "_none" ? Number(form.accountId) : null,
        projectId: form.projectId !== "_none" ? Number(form.projectId) : null,
        assigneeId: form.assigneeId !== "_none" ? Number(form.assigneeId) : null,
        reportedAt: new Date(form.reportedAt).toISOString(),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Ticket created" });
        queryClient.invalidateQueries({ queryKey: getListServiceTicketsQueryKey() });
        setOpen(false);
        setForm({ subject: "", description: "", category: "complaint", priority: "medium", accountId: "_none", projectId: "_none", assigneeId: "_none", reportedAt: new Date().toISOString().slice(0,10) });
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="page-service-tickets">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wrench className="h-6 w-6" /> Service Tickets</h1>
          <p className="text-muted-foreground">Customer issues, complaints, and service requests.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px]" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-ticket"><Plus className="w-4 h-4 mr-1" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Create Service Ticket</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="input-ticket-subject" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[80px]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="installation">Installation Issue</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="inverter">Inverter Fault</SelectItem>
                        <SelectItem value="panel">Panel Issue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Account</Label>
                    <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">(none)</SelectItem>
                        {accounts?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Project</Label>
                    <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">(none)</SelectItem>
                        {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.projectNumber} — {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Assign To</Label>
                    <Select value={form.assigneeId} onValueChange={(v) => setForm({ ...form, assigneeId: v })}>
                      <SelectTrigger data-testid="select-assignee"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">(none)</SelectItem>
                        {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Reported At *</Label><Input type="date" value={form.reportedAt} onChange={(e) => setForm({ ...form, reportedAt: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} disabled={createMutation.isPending} data-testid="btn-create-ticket">{createMutation.isPending ? "Creating..." : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-48 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets?.length ? tickets.map(t => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setLocation(`/service-tickets/${t.id}`)} data-testid={`row-ticket-${t.id}`}>
                    <TableCell className="font-mono text-xs text-primary">{t.ticketNumber}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{t.subject}</TableCell>
                    <TableCell>{t.accountName || "-"}</TableCell>
                    <TableCell className="capitalize">{t.category}</TableCell>
                    <TableCell>{priorityBadge(t.priority)}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>{t.assigneeName || "-"}</TableCell>
                    <TableCell>{formatDate(t.reportedAt)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No service tickets.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

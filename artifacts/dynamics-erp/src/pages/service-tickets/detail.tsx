import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetServiceTicket, getGetServiceTicketQueryKey, useUpdateServiceTicket,
  useCreateServiceVisit, useUpdateServiceVisit,
  useListUsers, getListServiceTicketsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { Wrench, Plus, HardHat, Building2 } from "lucide-react";

const STATUSES = ["open", "assigned", "in_progress", "resolved", "closed", "cancelled"];

export default function ServiceTicketDetail() {
  const [, params] = useRoute("/service-tickets/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ticket, isLoading } = useGetServiceTicket(id, {
    query: { enabled: !!id, queryKey: getGetServiceTicketQueryKey(id) },
  });
  const { data: users } = useListUsers();

  const updateMutation = useUpdateServiceTicket();
  const createVisitMutation = useCreateServiceVisit();
  const updateVisitMutation = useUpdateServiceVisit();

  const [status, setStatus] = useState("");
  const [assigneeId, setAssigneeId] = useState("_none");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({
    scheduledDate: new Date().toISOString().slice(0,10),
    engineerId: "_none", visitType: "service", notes: "",
  });

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setAssigneeId(ticket.assigneeId ? String(ticket.assigneeId) : "_none");
      setResolutionNotes(ticket.resolutionNotes ?? "");
    }
  }, [ticket]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: getGetServiceTicketQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListServiceTicketsQueryKey() });
  };

  const onSave = () => {
    updateMutation.mutate({
      id,
      data: {
        status: status as any,
        assigneeId: assigneeId !== "_none" ? Number(assigneeId) : null,
        resolutionNotes: resolutionNotes || null,
      },
    }, {
      onSuccess: () => { toast({ title: "Ticket updated" }); refetch(); },
    });
  };

  const onAddVisit = () => {
    createVisitMutation.mutate({
      data: {
        ticketId: id,
        scheduledDate: new Date(visitForm.scheduledDate).toISOString(),
        engineerId: visitForm.engineerId !== "_none" ? Number(visitForm.engineerId) : null,
        visitType: visitForm.visitType,
        notes: visitForm.notes || null,
      },
    }, {
      onSuccess: () => { toast({ title: "Visit scheduled" }); refetch(); setVisitOpen(false); setVisitForm({ scheduledDate: new Date().toISOString().slice(0,10), engineerId: "_none", visitType: "service", notes: "" }); },
    });
  };

  const onCompleteVisit = (visitId: number) => {
    updateVisitMutation.mutate({
      id: visitId,
      data: { status: "completed", completedDate: new Date().toISOString() },
    }, { onSuccess: () => refetch() });
  };

  if (isLoading || !ticket) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6" data-testid="page-ticket-detail">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wrench className="h-6 w-6" /> {ticket.subject}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
          <span className="font-mono text-muted-foreground">{ticket.ticketNumber}</span>
          <Badge variant="outline" className="capitalize">{ticket.status.replace("_", " ")}</Badge>
          <Badge variant="outline" className="capitalize">{ticket.priority}</Badge>
          <Badge variant="outline" className="capitalize">{ticket.category}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Ticket Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Reported At</p><p className="font-medium">{formatDate(ticket.reportedAt)}</p></div>
              <div><p className="text-muted-foreground">Resolved At</p><p className="font-medium">{ticket.resolvedAt ? formatDate(ticket.resolvedAt) : "-"}</p></div>
              <div>
                <p className="text-muted-foreground">Account</p>
                {ticket.accountId ? (
                  <Link href={`/accounts/${ticket.accountId}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {ticket.accountName}
                  </Link>
                ) : <p>-</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Project</p>
                {ticket.projectId ? (
                  <Link href={`/projects/${ticket.projectId}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                    <HardHat className="w-3 h-3" /> {ticket.projectName}
                  </Link>
                ) : <p>-</p>}
              </div>
            </div>
            {ticket.description && (
              <div className="pt-3 border-t">
                <p className="text-muted-foreground text-sm mb-1">Description</p>
                <p className="text-sm whitespace-pre-line">{ticket.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Update Ticket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-ticket-status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger data-testid="select-ticket-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(unassigned)</SelectItem>
                  {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} className="min-h-[80px]" data-testid="input-resolution-notes" />
            </div>
            <Button onClick={onSave} disabled={updateMutation.isPending} className="w-full" data-testid="btn-save-ticket">
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Service Visits</CardTitle>
          <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="btn-new-visit"><Plus className="w-4 h-4 mr-1" /> Schedule Visit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule Service Visit</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2"><Label>Scheduled Date *</Label><Input type="date" value={visitForm.scheduledDate} onChange={(e) => setVisitForm({ ...visitForm, scheduledDate: e.target.value })} data-testid="input-visit-date" /></div>
                <div className="space-y-2"><Label>Engineer</Label>
                  <Select value={visitForm.engineerId} onValueChange={(v) => setVisitForm({ ...visitForm, engineerId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">(none)</SelectItem>
                      {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Type</Label>
                  <Select value={visitForm.visitType} onValueChange={(v) => setVisitForm({ ...visitForm, visitType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="installation">Installation</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="amc">AMC Visit</SelectItem>
                      <SelectItem value="warranty">Warranty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVisitOpen(false)}>Cancel</Button>
                <Button onClick={onAddVisit} disabled={createVisitMutation.isPending} data-testid="btn-create-visit">Schedule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {(ticket.visits ?? []).length ? (ticket.visits ?? []).map(v => (
            <div key={v.id} className="p-3 border rounded text-sm flex items-center justify-between" data-testid={`visit-${v.id}`}>
              <div>
                <p className="font-medium">{formatDate(v.scheduledDate)} — {v.engineerName ?? "Unassigned"}</p>
                <p className="text-xs text-muted-foreground capitalize">{v.visitType} · {v.status} {v.completedDate && `· Completed ${formatDate(v.completedDate)}`}</p>
                {v.notes && <p className="text-xs mt-1 whitespace-pre-line">{v.notes}</p>}
              </div>
              {v.status !== "completed" && (
                <Button variant="outline" size="sm" onClick={() => onCompleteVisit(v.id)} data-testid={`btn-complete-visit-${v.id}`}>Mark Completed</Button>
              )}
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-4">No visits scheduled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

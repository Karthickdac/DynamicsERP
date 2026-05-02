import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAmcContracts, getListAmcContractsQueryKey,
  useCreateAmcContract, useUpdateAmcContract,
  useListAccounts, useListProjects,
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
import { formatINR, formatDate } from "@/lib/format";
import { ShieldCheck, Plus } from "lucide-react";

const STATUSES = ["active", "expired", "cancelled", "draft"];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
    expired: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
    draft: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
  };
  return <Badge variant="outline" className={`capitalize ${map[s] ?? ""}`}>{s}</Badge>;
}

export default function AmcContracts() {
  const [status, setStatus] = useState("_all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = status !== "_all" ? { status } : {};
  const { data: contracts, isLoading } = useListAmcContracts(params, {
    query: { queryKey: getListAmcContractsQueryKey(params) },
  });

  const { data: accounts } = useListAccounts();
  const { data: projects } = useListProjects();

  const [form, setForm] = useState({
    accountId: "_none", projectId: "_none",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    contractValue: "", visitsPerYear: "4", coverageDetails: "",
  });

  const createMutation = useCreateAmcContract();
  const updateMutation = useUpdateAmcContract();

  const onCreate = () => {
    createMutation.mutate({
      data: {
        accountId: form.accountId !== "_none" ? Number(form.accountId) : null,
        projectId: form.projectId !== "_none" ? Number(form.projectId) : null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        contractValue: form.contractValue ? Number(form.contractValue) : null,
        visitsPerYear: form.visitsPerYear ? Number(form.visitsPerYear) : null,
        coverageDetails: form.coverageDetails || null,
      },
    }, {
      onSuccess: () => {
        toast({ title: "AMC contract created" });
        queryClient.invalidateQueries({ queryKey: getListAmcContractsQueryKey() });
        setOpen(false);
        setForm({ accountId: "_none", projectId: "_none", startDate: new Date().toISOString().slice(0,10), endDate: new Date(Date.now()+365*86400000).toISOString().slice(0,10), contractValue: "", visitsPerYear: "4", coverageDetails: "" });
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  const onChangeStatus = (id: number, newStatus: string) => {
    updateMutation.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getListAmcContractsQueryKey() });
      },
    });
  };

  return (
    <div className="space-y-6" data-testid="page-amc-contracts">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> AMC Contracts</h1>
          <p className="text-muted-foreground">Annual maintenance contracts for installed solar systems.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-amc"><Plus className="w-4 h-4 mr-1" /> New AMC</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Create AMC Contract</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Account</Label>
                    <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                      <SelectTrigger data-testid="select-amc-account"><SelectValue /></SelectTrigger>
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
                  <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-amc-start" /></div>
                  <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-amc-end" /></div>
                  <div className="space-y-2"><Label>Contract Value (₹)</Label><Input type="number" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} data-testid="input-amc-value" /></div>
                  <div className="space-y-2"><Label>Visits Per Year</Label><Input type="number" value={form.visitsPerYear} onChange={(e) => setForm({ ...form, visitsPerYear: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Coverage Details</Label><Textarea value={form.coverageDetails} onChange={(e) => setForm({ ...form, coverageDetails: e.target.value })} className="min-h-[80px]" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} disabled={createMutation.isPending} data-testid="btn-create-amc">{createMutation.isPending ? "Creating..." : "Create"}</Button>
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
                  <TableHead>Contract #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Visits/Yr</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts?.length ? contracts.map(c => (
                  <TableRow key={c.id} data-testid={`row-amc-${c.id}`}>
                    <TableCell className="font-mono text-xs text-primary">{c.contractNumber}</TableCell>
                    <TableCell>{c.accountName ?? "-"}</TableCell>
                    <TableCell>{c.projectName ?? "-"}</TableCell>
                    <TableCell>{formatDate(c.startDate)}</TableCell>
                    <TableCell>{formatDate(c.endDate)}</TableCell>
                    <TableCell className="text-right">{formatINR(c.contractValue)}</TableCell>
                    <TableCell className="text-right">{c.visitsPerYear}</TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={(v) => onChangeStatus(c.id, v)}>
                        <SelectTrigger className="w-[120px] h-8" data-testid={`select-status-amc-${c.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No AMC contracts.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

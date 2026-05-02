import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, getListProjectsQueryKey,
  useCreateProject,
  useListAccounts, useListUsers, useListSalesOrders,
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
import { HardHat, Plus, Search } from "lucide-react";

const STAGES = ["site_survey", "design", "procurement", "installation", "testing", "commissioning", "handover", "cancelled"] as const;
const STAGE_LABEL: Record<string, string> = {
  site_survey: "Site Survey", design: "Design", procurement: "Procurement",
  installation: "Installation", testing: "Testing", commissioning: "Commissioning",
  handover: "Handover", cancelled: "Cancelled",
};

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    site_survey: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
    design: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300",
    procurement: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
    installation: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
    testing: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300",
    commissioning: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300",
    handover: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  };
  return <Badge variant="outline" className={`${map[stage] ?? ""}`}>{STAGE_LABEL[stage] ?? stage}</Badge>;
}

const INDIAN_STATES = ["Andhra Pradesh", "Bihar", "Delhi", "Gujarat", "Haryana", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal"];

export default function Projects() {
  const [stage, setStage] = useState("_all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, string> = {};
  if (stage !== "_all") params.stage = stage;
  if (search) params.search = search;
  const { data: projects, isLoading } = useListProjects(params, {
    query: { queryKey: getListProjectsQueryKey(params) },
  });

  const { data: accounts } = useListAccounts();
  const { data: users } = useListUsers();
  const { data: salesOrders } = useListSalesOrders();

  const [form, setForm] = useState({
    name: "", description: "", capacityKwp: "", siteAddress: "", siteCity: "", siteState: "",
    sitePincode: "", startDate: "", expectedEndDate: "", budget: "",
    accountId: "_none", managerId: "_none", salesOrderId: "_none",
  });

  const createMutation = useCreateProject();
  const onCreate = () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    createMutation.mutate({
      data: {
        name: form.name,
        description: form.description || null,
        capacityKwp: form.capacityKwp ? Number(form.capacityKwp) : null,
        siteAddress: form.siteAddress || null,
        siteCity: form.siteCity || null,
        siteState: form.siteState || null,
        sitePincode: form.sitePincode || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        expectedEndDate: form.expectedEndDate ? new Date(form.expectedEndDate).toISOString() : null,
        budget: form.budget ? Number(form.budget) : null,
        accountId: form.accountId !== "_none" ? Number(form.accountId) : null,
        managerId: form.managerId !== "_none" ? Number(form.managerId) : null,
        salesOrderId: form.salesOrderId !== "_none" ? Number(form.salesOrderId) : null,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Project created" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpen(false);
        setForm({ name: "", description: "", capacityKwp: "", siteAddress: "", siteCity: "", siteState: "", sitePincode: "", startDate: "", expectedEndDate: "", budget: "", accountId: "_none", managerId: "_none", salesOrderId: "_none" });
      },
      onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="page-projects">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><HardHat className="h-6 w-6" /> Projects</h1>
          <p className="text-muted-foreground">Solar installation projects in execution.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px]" data-testid="input-search" />
          </div>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-[180px]" data-testid="select-stage-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Stages</SelectItem>
              {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-project"><Plus className="w-4 h-4 mr-1" /> New Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="col-span-2 space-y-2">
                  <Label>Project Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-project-name" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[60px]" />
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">(none)</SelectItem>
                      {accounts?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manager</Label>
                  <Select value={form.managerId} onValueChange={(v) => setForm({ ...form, managerId: v })}>
                    <SelectTrigger data-testid="select-manager"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">(none)</SelectItem>
                      {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source Sales Order</Label>
                  <Select value={form.salesOrderId} onValueChange={(v) => setForm({ ...form, salesOrderId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">(none)</SelectItem>
                      {salesOrders?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.orderNumber} — {s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity (kWp)</Label>
                  <Input type="number" step="0.1" value={form.capacityKwp} onChange={(e) => setForm({ ...form, capacityKwp: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Site Address</Label>
                  <Input value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.siteCity} onChange={(e) => setForm({ ...form, siteCity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={form.siteState || "_none"} onValueChange={(v) => setForm({ ...form, siteState: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">(none)</SelectItem>
                      {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={form.sitePincode} onChange={(e) => setForm({ ...form, sitePincode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Budget (₹)</Label>
                  <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expected End Date</Label>
                  <Input type="date" value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} disabled={createMutation.isPending} data-testid="btn-create-project">
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
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
                  <TableHead>Project #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Expected End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects?.length ? projects.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setLocation(`/projects/${p.id}`)} data-testid={`row-project-${p.id}`}>
                    <TableCell className="font-mono text-xs text-primary">{p.projectNumber}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.accountName || "-"}</TableCell>
                    <TableCell>{stageBadge(p.stage)}</TableCell>
                    <TableCell className="text-right">{p.capacityKwp != null ? `${p.capacityKwp} kWp` : "-"}</TableCell>
                    <TableCell className="text-right">{p.budget != null ? formatINR(p.budget) : "-"}</TableCell>
                    <TableCell>{p.managerName || "-"}</TableCell>
                    <TableCell>{formatDate(p.expectedEndDate)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No projects yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

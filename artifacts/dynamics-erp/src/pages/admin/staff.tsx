import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PrintExportButtons } from "@/components/print-export-buttons";
import {
  useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff,
  useSyncMysticsHrStaff, getListStaffQueryKey,
} from "@workspace/api-client-react";

export default function StaffPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const { data: staff = [], isLoading } = useListStaff({
    search: search || undefined,
    status: status === "__all__" ? undefined : status,
  });
  const syncMut = useSyncMysticsHrStaff();
  const refresh = () => qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
  const [editing, setEditing] = useState<any | null>(null);

  const onSync = () => {
    syncMut.mutate(undefined, {
      onSuccess: (r) => {
        toast({ title: `MysticsHR sync — ${r.status}`, description: r.message });
        refresh();
      },
      onError: (err: any) => toast({ title: "Sync failed", description: err?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="page-title">Staff</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSync} disabled={syncMut.isPending} data-testid="btn-sync-mysticshr">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sync from MysticsHR
          </Button>
          <PrintExportButtons
            title="DynamicsERP — Staff Directory"
            filename={`staff-${new Date().toISOString().slice(0, 10)}`}
            columns={["Code", "Name", "Designation", "Department", "Email", "Phone", "Status"]}
            rows={staff.map(s => [s.employeeCode, `${s.firstName} ${s.lastName}`, s.designation ?? "", s.department ?? "", s.email ?? "", s.phone ?? "", s.status])}
          />
          <StaffDialog mode="create" onSaved={refresh} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Staff records sourced from MysticsHR or added manually. Sync runs only when MysticsHR connector is enabled in Admin &gt; Integrations.</p>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search by name, email, code" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" data-testid="input-search" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead>
                <TableHead>Department</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead>
                <TableHead>Source</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow> :
                staff.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No staff yet. Add manually or run a MysticsHR sync.</TableCell></TableRow> :
                staff.map(s => (
                  <TableRow key={s.id} data-testid={`row-staff-${s.id}`}>
                    <TableCell className="font-mono text-xs">{s.employeeCode}</TableCell>
                    <TableCell>{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.designation ?? "-"}</TableCell>
                    <TableCell>{s.department ?? "-"}</TableCell>
                    <TableCell>{s.email ?? "-"}</TableCell>
                    <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{s.source}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)} data-testid={`btn-edit-${s.id}`}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && <StaffDialog mode="edit" staff={editing} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} onSaved={refresh} />}
    </div>
  );
}

function StaffDialog({ mode, staff, open: controlledOpen, onOpenChange, onSaved }: { mode: "create" | "edit"; staff?: any; open?: boolean; onOpenChange?: (v: boolean) => void; onSaved: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { toast } = useToast();
  const createMut = useCreateStaff();
  const updateMut = useUpdateStaff();
  const deleteMut = useDeleteStaff();
  const form = useForm<any>({ defaultValues: staff ?? { status: "active", employmentType: "full_time" } });

  const submit = (values: any) => {
    const payload: any = { ...values };
    if (mode === "create") {
      createMut.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Staff added" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
      });
    } else {
      updateMut.mutate({ id: staff.id, data: payload }, {
        onSuccess: () => { toast({ title: "Staff updated" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
      });
    }
  };

  const deactivate = () => {
    if (!confirm("Mark this staff member as inactive?")) return;
    deleteMut.mutate({ id: staff.id }, {
      onSuccess: () => { toast({ title: "Marked inactive" }); setOpen(false); onSaved(); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" && <DialogTrigger asChild><Button data-testid="btn-new-staff"><Plus className="h-4 w-4 mr-1.5" /> Add Staff</Button></DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{mode === "create" ? "Add Staff" : "Edit Staff"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Employee Code</Label><Input {...form.register("employeeCode")} data-testid="field-employeeCode" /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
              <SelectTrigger data-testid="field-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>First name</Label><Input {...form.register("firstName")} data-testid="field-firstName" /></div>
          <div><Label>Last name</Label><Input {...form.register("lastName")} data-testid="field-lastName" /></div>
          <div><Label>Email</Label><Input type="email" {...form.register("email")} data-testid="field-email" /></div>
          <div><Label>Phone</Label><Input {...form.register("phone")} data-testid="field-phone" /></div>
          <div><Label>Designation</Label><Input {...form.register("designation")} data-testid="field-designation" /></div>
          <div><Label>Department</Label><Input {...form.register("department")} data-testid="field-department" /></div>
          <div><Label>Joining Date</Label><Input type="date" {...form.register("joiningDate")} /></div>
          <div><Label>Employment Type</Label><Input {...form.register("employmentType")} placeholder="full_time / contract / intern" /></div>
          <div className="col-span-2"><Label>Work Location</Label><Input {...form.register("workLocation")} /></div>
          <div className="col-span-2"><Label>Notes</Label><Textarea rows={3} {...form.register("notes")} /></div>
        </div>
        <DialogFooter>
          {mode === "edit" && <Button variant="ghost" className="mr-auto text-destructive" onClick={deactivate}>Mark Inactive</Button>}
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={form.handleSubmit(submit)} data-testid="btn-save-staff">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

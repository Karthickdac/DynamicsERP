import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, Pencil, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PrintExportButtons } from "@/components/print-export-buttons";
import {
  useListUsers, useCreateUser, useUpdateUser, useResetUserPassword, useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";

const ROLES = ["admin", "sales", "project_manager", "finance", "service", "engineer"];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("__all__");
  const [activeOnly, setActiveOnly] = useState<"all" | "true" | "false">("all");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useListUsers({
    search: search || undefined,
    role: role === "__all__" ? undefined : role,
    isActive: activeOnly === "all" ? undefined : (activeOnly === "true"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const [editing, setEditing] = useState<any | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="page-title">Users</h1>
        <div className="flex gap-2">
          <PrintExportButtons
            title="DynamicsERP — Users"
            filename={`users-${new Date().toISOString().slice(0, 10)}`}
            columns={["Name", "Email", "Role", "Department", "Status"]}
            rows={users.map(u => [`${u.firstName} ${u.lastName}`, u.email, u.role, u.department ?? "", u.isActive ? "Active" : "Inactive"])}
          />
          <UserDialog mode="create" onSaved={refresh} />
        </div>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" data-testid="input-search" />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-44" data-testid="select-role-filter"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All roles</SelectItem>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeOnly} onValueChange={(v: any) => setActiveOnly(v)}>
              <SelectTrigger className="w-44" data-testid="select-active-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active only</SelectItem>
                <SelectItem value="false">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
                <TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow> :
                users.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow> :
                users.map(u => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                    <TableCell>{u.department ?? "-"}</TableCell>
                    <TableCell>
                      {u.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)} data-testid={`btn-edit-${u.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setResettingId(u.id)} data-testid={`btn-reset-${u.id}`}><KeyRound className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <UserDialog mode="edit" user={editing} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} onSaved={refresh} />
      )}
      {resettingId && (
        <ResetPasswordDialog userId={resettingId} open={!!resettingId} onClose={() => setResettingId(null)} />
      )}
    </div>
  );
}

function UserDialog({ mode, user, open: controlledOpen, onOpenChange, onSaved }: { mode: "create" | "edit"; user?: any; open?: boolean; onOpenChange?: (v: boolean) => void; onSaved: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { toast } = useToast();
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deactivateMut = useDeleteUser();
  const form = useForm<any>({
    defaultValues: user ? { ...user, password: "" } : { role: "sales", isActive: true },
  });

  const submit = (values: any) => {
    const payload = { ...values };
    if (mode === "create") {
      createMut.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "User created" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message ?? String(err), variant: "destructive" }),
      });
    } else {
      const { password, ...rest } = payload;
      const update: any = { ...rest };
      if (password && String(password).length >= 8) update.password = password;
      updateMut.mutate({ id: user.id, data: update }, {
        onSuccess: () => { toast({ title: "User updated" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message ?? String(err), variant: "destructive" }),
      });
    }
  };

  const deactivate = () => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;
    deactivateMut.mutate({ id: user.id }, {
      onSuccess: () => { toast({ title: "User deactivated" }); setOpen(false); onSaved(); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" && (
        <DialogTrigger asChild>
          <Button data-testid="btn-new-user"><Plus className="h-4 w-4 mr-1.5" /> New User</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{mode === "create" ? "Create User" : "Edit User"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input {...form.register("firstName")} data-testid="field-firstName" /></div>
          <div><Label>Last name</Label><Input {...form.register("lastName")} data-testid="field-lastName" /></div>
          <div><Label>Email</Label><Input type="email" {...form.register("email")} data-testid="field-email" /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v)}>
              <SelectTrigger data-testid="field-role"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Phone</Label><Input {...form.register("phone")} data-testid="field-phone" /></div>
          <div><Label>Designation</Label><Input {...form.register("designation")} data-testid="field-designation" /></div>
          <div><Label>Department</Label><Input {...form.register("department")} data-testid="field-department" /></div>
          <div><Label>Employee Code</Label><Input {...form.register("employeeCode")} data-testid="field-employeeCode" /></div>
          <div className="col-span-2"><Label>Password {mode === "edit" ? "(leave blank to keep current)" : "(min 8 characters)"}</Label><Input type="password" {...form.register("password")} data-testid="field-password" /></div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="isActive" {...form.register("isActive")} className="h-4 w-4" />
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          {mode === "edit" && <Button variant="ghost" className="mr-auto text-destructive" onClick={deactivate}><Power className="h-4 w-4 mr-1.5" /> Deactivate</Button>}
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={form.handleSubmit(submit)} disabled={createMut.isPending || updateMut.isPending} data-testid="btn-save-user">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, open, onClose }: { userId: number; open: boolean; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const { toast } = useToast();
  const mut = useResetUserPassword();
  const submit = () => {
    if (pwd.length < 8) { toast({ title: "Password too short", variant: "destructive" }); return; }
    mut.mutate({ id: userId, data: { password: pwd } }, {
      onSuccess: () => { toast({ title: "Password reset" }); onClose(); setPwd(""); },
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>New password (min 8 characters)</Label>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} data-testid="field-new-password" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} data-testid="btn-confirm-reset">Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

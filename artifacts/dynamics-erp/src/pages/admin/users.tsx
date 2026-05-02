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
  type User,
  type CreateUserInput,
  type UpdateUserInput,
  type UserRole,
} from "@workspace/api-client-react";

const ROLES: UserRole[] = ["admin", "sales", "project_manager", "finance", "service", "engineer"];

type CreateFormValues = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  designation: string;
  department: string;
  employeeCode: string;
  isActive: boolean;
};

type EditFormValues = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  designation: string;
  department: string;
  employeeCode: string;
  isActive: boolean;
};

const ALL_FIELDS = [
  "email", "password", "firstName", "lastName", "role",
  "phone", "designation", "department", "employeeCode", "isActive",
] as const;

type FieldName = (typeof ALL_FIELDS)[number];

function isFieldName(value: string): value is FieldName {
  return (ALL_FIELDS as readonly string[]).includes(value);
}

type ApiError = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      issues?: Array<{ path?: Array<string | number>; message?: string }>;
    };
    status?: number;
  };
};

function extractErrorMessage(err: unknown): string {
  const e = err as ApiError;
  return e?.response?.data?.error ?? e?.message ?? "Request failed";
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("__all__");
  const [activeOnly, setActiveOnly] = useState<"all" | "true" | "false">("all");
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useListUsers({
    search: search || undefined,
    role: role === "__all__" ? undefined : role,
    isActive: activeOnly === "all" ? undefined : (activeOnly === "true"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const [editing, setEditing] = useState<User | null>(null);
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
          <CreateUserDialog onSaved={refresh} />
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
        <EditUserDialog user={editing} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} onSaved={refresh} />
      )}
      {resettingId && (
        <ResetPasswordDialog userId={resettingId} open={!!resettingId} onClose={() => setResettingId(null)} />
      )}
    </div>
  );
}

function FieldError({ message, testId }: { message?: string; testId?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive mt-1" data-testid={testId}>{message}</p>
  );
}

function CreateUserDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createMut = useCreateUser();
  const form = useForm<CreateFormValues>({
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "sales",
      phone: "",
      designation: "",
      department: "",
      employeeCode: "",
      isActive: true,
    },
  });
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    const payload: CreateUserInput = {
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      role: values.role,
      phone: values.phone.trim() ? values.phone.trim() : null,
      designation: values.designation.trim() ? values.designation.trim() : null,
      department: values.department.trim() ? values.department.trim() : null,
      employeeCode: values.employeeCode.trim() ? values.employeeCode.trim() : null,
      isActive: values.isActive,
    };
    createMut.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "User created" });
        form.reset();
        setOpen(false);
        onSaved();
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        const issues = e?.response?.data?.issues ?? [];
        let mappedToField = false;
        for (const issue of issues) {
          const key = issue.path?.[0];
          if (typeof key === "string" && isFieldName(key)) {
            form.setError(key, { type: "server", message: issue.message ?? "Invalid value" });
            mappedToField = true;
          }
        }
        const message = extractErrorMessage(err);
        if (!mappedToField) setFormError(message);
        toast({ title: "Failed to create user", description: message, variant: "destructive" });
      },
    });
  });

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormError(null); form.clearErrors(); } }}>
      <DialogTrigger asChild>
        <Button data-testid="btn-new-user"><Plus className="h-4 w-4 mr-1.5" /> New User</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name<span className="text-destructive">*</span></Label>
              <Input {...form.register("firstName", { required: "First name is required" })} data-testid="field-firstName" />
              <FieldError message={errors.firstName?.message} testId="error-firstName" />
            </div>
            <div>
              <Label>Last name<span className="text-destructive">*</span></Label>
              <Input {...form.register("lastName", { required: "Last name is required" })} data-testid="field-lastName" />
              <FieldError message={errors.lastName?.message} testId="error-lastName" />
            </div>
            <div>
              <Label>Email<span className="text-destructive">*</span></Label>
              <Input type="email" autoComplete="off" {...form.register("email", { required: "Email is required" })} data-testid="field-email" />
              <FieldError message={errors.email?.message} testId="error-email" />
            </div>
            <div>
              <Label>Role<span className="text-destructive">*</span></Label>
              <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as UserRole)}>
                <SelectTrigger data-testid="field-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError message={errors.role?.message} testId="error-role" />
            </div>
            <div><Label>Phone</Label><Input {...form.register("phone")} data-testid="field-phone" /></div>
            <div><Label>Designation</Label><Input {...form.register("designation")} data-testid="field-designation" /></div>
            <div><Label>Department</Label><Input {...form.register("department")} data-testid="field-department" /></div>
            <div><Label>Employee Code</Label><Input {...form.register("employeeCode")} data-testid="field-employeeCode" /></div>
            <div className="col-span-2">
              <Label>Password<span className="text-destructive">*</span> <span className="text-xs text-muted-foreground">(min 8 characters)</span></Label>
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Password must be at least 8 characters" },
                })}
                data-testid="field-password"
              />
              <FieldError message={errors.password?.message} testId="error-password" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isActive-create" {...form.register("isActive")} className="h-4 w-4" />
              <Label htmlFor="isActive-create" className="cursor-pointer">Active</Label>
            </div>
          </div>
          {formError && (
            <p className="text-sm text-destructive mt-3" data-testid="form-error">{formError}</p>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending} data-testid="btn-save-user">Create user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, open, onOpenChange, onSaved }: { user: User; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { toast } = useToast();
  const updateMut = useUpdateUser();
  const deactivateMut = useDeleteUser();
  const form = useForm<EditFormValues>({
    defaultValues: {
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone ?? "",
      designation: user.designation ?? "",
      department: user.department ?? "",
      employeeCode: user.employeeCode ?? "",
      isActive: user.isActive,
    },
  });
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    const update: UpdateUserInput = {};
    const trimmedEmail = values.email.trim();
    if (trimmedEmail && trimmedEmail !== user.email) update.email = trimmedEmail;
    if (values.firstName.trim() && values.firstName.trim() !== user.firstName) update.firstName = values.firstName.trim();
    if (values.lastName.trim() && values.lastName.trim() !== user.lastName) update.lastName = values.lastName.trim();
    if (values.role !== user.role) update.role = values.role;
    const phone = values.phone.trim() ? values.phone.trim() : null;
    if (phone !== (user.phone ?? null)) update.phone = phone;
    const designation = values.designation.trim() ? values.designation.trim() : null;
    if (designation !== (user.designation ?? null)) update.designation = designation;
    const department = values.department.trim() ? values.department.trim() : null;
    if (department !== (user.department ?? null)) update.department = department;
    const employeeCode = values.employeeCode.trim() ? values.employeeCode.trim() : null;
    if (employeeCode !== (user.employeeCode ?? null)) update.employeeCode = employeeCode;
    if (values.isActive !== user.isActive) update.isActive = values.isActive;
    if (values.password && values.password.length > 0) {
      update.password = values.password;
    }
    if (Object.keys(update).length === 0) {
      toast({ title: "No changes to save" });
      onOpenChange(false);
      return;
    }

    updateMut.mutate({ id: user.id, data: update }, {
      onSuccess: () => {
        toast({ title: "User updated" });
        onOpenChange(false);
        onSaved();
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        const issues = e?.response?.data?.issues ?? [];
        let mappedToField = false;
        for (const issue of issues) {
          const key = issue.path?.[0];
          if (typeof key === "string" && isFieldName(key)) {
            form.setError(key, { type: "server", message: issue.message ?? "Invalid value" });
            mappedToField = true;
          }
        }
        const message = extractErrorMessage(err);
        if (!mappedToField) setFormError(message);
        toast({ title: "Failed to update user", description: message, variant: "destructive" });
      },
    });
  });

  const deactivate = () => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;
    deactivateMut.mutate({ id: user.id }, {
      onSuccess: () => { toast({ title: "User deactivated" }); onOpenChange(false); onSaved(); },
    });
  };

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input {...form.register("firstName", { validate: (v) => v.trim().length > 0 || "First name cannot be empty" })} data-testid="field-firstName" />
              <FieldError message={errors.firstName?.message} testId="error-firstName" />
            </div>
            <div>
              <Label>Last name</Label>
              <Input {...form.register("lastName", { validate: (v) => v.trim().length > 0 || "Last name cannot be empty" })} data-testid="field-lastName" />
              <FieldError message={errors.lastName?.message} testId="error-lastName" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" autoComplete="off" {...form.register("email", { validate: (v) => v.trim().length > 0 || "Email cannot be empty" })} data-testid="field-email" />
              <FieldError message={errors.email?.message} testId="error-email" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as UserRole)}>
                <SelectTrigger data-testid="field-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError message={errors.role?.message} testId="error-role" />
            </div>
            <div><Label>Phone</Label><Input {...form.register("phone")} data-testid="field-phone" /></div>
            <div><Label>Designation</Label><Input {...form.register("designation")} data-testid="field-designation" /></div>
            <div><Label>Department</Label><Input {...form.register("department")} data-testid="field-department" /></div>
            <div><Label>Employee Code</Label><Input {...form.register("employeeCode")} data-testid="field-employeeCode" /></div>
            <div className="col-span-2">
              <Label>Password <span className="text-xs text-muted-foreground">(leave blank to keep current; min 8 characters when changing)</span></Label>
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register("password", {
                  validate: (v) => !v || v.length >= 8 || "Password must be at least 8 characters",
                })}
                data-testid="field-password"
              />
              <FieldError message={errors.password?.message} testId="error-password" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isActive-edit" {...form.register("isActive")} className="h-4 w-4" />
              <Label htmlFor="isActive-edit" className="cursor-pointer">Active</Label>
            </div>
          </div>
          {formError && (
            <p className="text-sm text-destructive mt-3" data-testid="form-error">{formError}</p>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={deactivate}><Power className="h-4 w-4 mr-1.5" /> Deactivate</Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMut.isPending} data-testid="btn-save-user">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, open, onClose }: { userId: number; open: boolean; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const mut = useResetUserPassword();
  const submit = () => {
    if (pwd.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(null);
    mut.mutate({ id: userId, data: { password: pwd } }, {
      onSuccess: () => { toast({ title: "Password reset" }); onClose(); setPwd(""); },
      onError: (err: unknown) => {
        const message = extractErrorMessage(err);
        setError(message);
        toast({ title: "Failed to reset password", description: message, variant: "destructive" });
      },
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>New password (min 8 characters)</Label>
          <Input type="password" value={pwd} onChange={(e) => { setPwd(e.target.value); setError(null); }} data-testid="field-new-password" />
          <FieldError message={error ?? undefined} testId="error-new-password" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending} data-testid="btn-confirm-reset">Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

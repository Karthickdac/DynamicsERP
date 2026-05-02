import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApprovalRules,
  getListApprovalRulesQueryKey,
  useCreateApprovalRule,
  useUpdateApprovalRule,
  useDeleteApprovalRule,
  ApprovalRule,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/format";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
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

const ROLES = ["admin", "sales", "finance", "project_manager", "service"] as const;

const ruleSchema = z.object({
  name: z.string().min(1),
  minAmount: z.coerce.number().min(0),
  maxAmount: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  approverRole: z.enum(ROLES),
  level: z.coerce.number().min(1),
  isActive: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

export default function ApprovalRules() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalRule | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rules, isLoading } = useListApprovalRules({
    query: { queryKey: getListApprovalRulesQueryKey() },
  });

  const createMutation = useCreateApprovalRule();
  const updateMutation = useUpdateApprovalRule();
  const deleteMutation = useDeleteApprovalRule();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: "", minAmount: 0, maxAmount: "", approverRole: "sales", level: 1, isActive: true },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", minAmount: 0, maxAmount: "", approverRole: "sales", level: 1, isActive: true });
    setOpen(true);
  };

  const openEdit = (r: ApprovalRule) => {
    setEditing(r);
    form.reset({
      name: r.name,
      minAmount: r.minAmount,
      maxAmount: r.maxAmount ?? "",
      approverRole: r.approverRole as any,
      level: r.level,
      isActive: r.isActive,
    });
    setOpen(true);
  };

  const onSubmit = (values: RuleFormValues) => {
    const payload: any = {
      name: values.name,
      entityType: "quotation",
      minAmount: values.minAmount,
      maxAmount: values.maxAmount === "" || values.maxAmount == null ? null : Number(values.maxAmount),
      approverRole: values.approverRole,
      level: values.level,
      isActive: values.isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListApprovalRulesQueryKey() }); setOpen(false); toast({ title: "Rule updated" }); },
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListApprovalRulesQueryKey() }); setOpen(false); toast({ title: "Rule created" }); },
      });
    }
  };

  const onDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListApprovalRulesQueryKey() }); toast({ title: "Rule deleted" }); },
    });
  };

  return (
    <div className="space-y-6" data-testid="page-approval-rules">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="h-6 w-6" /> Approval Rules</h1>
          <p className="text-muted-foreground">Rules are evaluated when a quotation is submitted. Multiple matching rules create multi-level approvals.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="btn-new-rule"><Plus className="w-4 h-4 mr-2" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Rule" : "Add Rule"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="minAmount" render={({ field }) => (
                    <FormItem><FormLabel>Min Amount (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="maxAmount" render={({ field }) => (
                    <FormItem><FormLabel>Max Amount (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="No limit" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="approverRole" render={({ field }) => (
                    <FormItem><FormLabel>Approver Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="level" render={({ field }) => (
                    <FormItem><FormLabel>Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>Active</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>Save Rule</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Min Amount</TableHead>
                <TableHead className="text-right">Max Amount</TableHead>
                <TableHead>Approver Role</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && rules?.length ? rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{formatINR(r.minAmount)}</TableCell>
                  <TableCell className="text-right">{r.maxAmount != null ? formatINR(r.maxAmount) : "No limit"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.approverRole.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{r.level}</TableCell>
                  <TableCell><Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`btn-edit-rule-${r.id}`}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`btn-delete-rule-${r.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(r.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No rules configured."}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

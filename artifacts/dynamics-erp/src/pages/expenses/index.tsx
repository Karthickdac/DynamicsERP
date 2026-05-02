import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExpenses, getListExpensesQueryKey, useCreateExpense,
  useSubmitExpense, useApproveExpense, useRejectExpense, useReimburseExpense,
  useListProjects,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wallet, Send, CheckCircle, XCircle, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";

const STATUSES = [
  { value: "_all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "rejected", label: "Rejected" },
];

const CATEGORIES = ["travel", "accommodation", "site", "material", "utilities", "other"];

const STATUS_CLASSES: Record<string, string> = {
  draft: "",
  submitted: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
  reimbursed: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
};

const schema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().min(1),
  projectId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function Expenses() {
  const [tab, setTab] = useState("_all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const status = tab === "_all" ? undefined : tab;
  const { data: expenses, isLoading } = useListExpenses({ ...(status ? { status } : {}) } as any);
  const { data: projects } = useListProjects();
  const createMutation = useCreateExpense();
  const submitMutation = useSubmitExpense();
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();
  const reimburseMutation = useReimburseExpense();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { category: "travel", amount: 0, expenseDate: new Date().toISOString().slice(0, 10), projectId: "_none", description: "", notes: "" },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });

  const onCreate = (v: z.infer<typeof schema>) => {
    createMutation.mutate({ data: {
      category: v.category,
      amount: v.amount,
      expenseDate: v.expenseDate,
      projectId: v.projectId && v.projectId !== "_none" ? parseInt(v.projectId) : null,
      description: v.description || null,
      notes: v.notes || null,
    } }, {
      onSuccess: () => { toast({ title: "Expense draft created" }); refetch(); setOpen(false); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const action = (mut: any, name: string, id: number, body?: any) => {
    const arg = body !== undefined ? { id, data: body } : { id };
    mut.mutate(arg, {
      onSuccess: () => { toast({ title: name }); refetch(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Submit, approve, and reimburse company expenses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="btn-new-expense"><Plus className="mr-2 h-4 w-4" />New Expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Expense</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-amount" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="expenseDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem><FormLabel>Project (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-project"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                <DialogFooter><Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-expense">Save Draft</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{STATUSES.map(s => <TabsTrigger key={s.value} value={s.value} data-testid={`tab-${s.value}`}>{s.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          : expenses && expenses.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Expense #</TableHead><TableHead>Submitter</TableHead><TableHead>Category</TableHead>
                <TableHead>Project</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead>
                <TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>{expenses.map(e => (
                <TableRow key={e.id} data-testid={`row-expense-${e.id}`}>
                  <TableCell className="font-mono">{e.expenseNumber}</TableCell>
                  <TableCell>{e.submittedByName ?? "-"}</TableCell>
                  <TableCell className="capitalize">{e.category}</TableCell>
                  <TableCell>{e.projectName ?? "-"}</TableCell>
                  <TableCell>{formatDate(e.expenseDate)}</TableCell>
                  <TableCell className="font-medium">{formatINR(e.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_CLASSES[e.status] ?? ""}>{e.status}</Badge></TableCell>
                  <TableCell><div className="flex gap-1 flex-wrap">
                    {(e.status === "draft" || e.status === "rejected") && <Button size="sm" variant="outline" onClick={() => action(submitMutation, "Submitted", e.id)} data-testid={`btn-submit-${e.id}`}><Send className="h-3 w-3 mr-1" />Submit</Button>}
                    {e.status === "submitted" && <>
                      <Button size="sm" onClick={() => action(approveMutation, "Approved", e.id)} data-testid={`btn-approve-${e.id}`}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => action(rejectMutation, "Rejected", e.id, { reason: "Insufficient documentation" })} data-testid={`btn-reject-${e.id}`}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                    </>}
                    {e.status === "approved" && <Button size="sm" variant="outline" onClick={() => action(reimburseMutation, "Reimbursed", e.id)} data-testid={`btn-reimburse-${e.id}`}><IndianRupee className="h-3 w-3 mr-1" />Reimburse</Button>}
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No expenses recorded.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

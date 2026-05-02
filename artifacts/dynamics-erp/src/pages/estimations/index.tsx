import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEstimations,
  getListEstimationsQueryKey,
  useCreateEstimation,
  useUpdateEstimation,
  useDeleteEstimation,
  useListAccounts,
  useListLeads,
  Estimation,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { Plus, Calculator, Edit, Trash2 } from "lucide-react";
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

const estSchema = z.object({
  title: z.string().min(1),
  leadId: z.string().optional(),
  accountId: z.string().optional(),
  capacityKwp: z.coerce.number().min(0.01),
  panelCost: z.coerce.number().min(0).default(0),
  inverterCost: z.coerce.number().min(0).default(0),
  structureCost: z.coerce.number().min(0).default(0),
  batteryCost: z.coerce.number().min(0).default(0),
  cableCost: z.coerce.number().min(0).default(0),
  installationCost: z.coerce.number().min(0).default(0),
  civilWorksCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  contingencyPct: z.coerce.number().min(0).default(5),
  marginPct: z.coerce.number().min(0).default(15),
  notes: z.string().optional(),
});

type EstFormValues = z.infer<typeof estSchema>;

const defaults: EstFormValues = {
  title: "", leadId: "_none", accountId: "_none", capacityKwp: 0,
  panelCost: 0, inverterCost: 0, structureCost: 0, batteryCost: 0,
  cableCost: 0, installationCost: 0, civilWorksCost: 0, otherCost: 0,
  contingencyPct: 5, marginPct: 15, notes: "",
};

export default function Estimations() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Estimation | null>(null);
  const [viewing, setViewing] = useState<Estimation | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: estimations, isLoading } = useListEstimations(undefined, {
    query: { queryKey: getListEstimationsQueryKey() },
  });
  const { data: accounts } = useListAccounts();
  const { data: leads } = useListLeads();

  const createMutation = useCreateEstimation();
  const updateMutation = useUpdateEstimation();
  const deleteMutation = useDeleteEstimation();

  const form = useForm<EstFormValues>({
    resolver: zodResolver(estSchema),
    defaultValues: defaults,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  };

  const openEdit = (e: Estimation) => {
    setEditing(e);
    form.reset({
      title: e.title,
      leadId: e.leadId ? e.leadId.toString() : "_none",
      accountId: e.accountId ? e.accountId.toString() : "_none",
      capacityKwp: e.capacityKwp,
      panelCost: e.panelCost,
      inverterCost: e.inverterCost,
      structureCost: e.structureCost,
      batteryCost: e.batteryCost,
      cableCost: e.cableCost,
      installationCost: e.installationCost,
      civilWorksCost: e.civilWorksCost,
      otherCost: e.otherCost,
      contingencyPct: e.contingencyPct,
      marginPct: e.marginPct,
      notes: e.notes ?? "",
    });
    setViewing(null);
    setOpen(true);
  };

  const onSubmit = (values: EstFormValues) => {
    const payload: any = {
      ...values,
      leadId: values.leadId === "_none" || !values.leadId ? null : parseInt(values.leadId),
      accountId: values.accountId === "_none" || !values.accountId ? null : parseInt(values.accountId),
      notes: values.notes || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEstimationsQueryKey() }); setOpen(false); toast({ title: "Estimation updated" }); },
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEstimationsQueryKey() }); setOpen(false); toast({ title: "Estimation created" }); },
      });
    }
  };

  const onDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEstimationsQueryKey() }); setViewing(null); toast({ title: "Estimation deleted" }); },
    });
  };

  return (
    <div className="space-y-6" data-testid="page-estimations">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Calculator className="h-6 w-6" /> Estimations</h1>
          <p className="text-muted-foreground">Quick cost estimations for solar projects.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="btn-new-estimation"><Plus className="w-4 h-4 mr-2" /> New Estimation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Estimation" : "New Estimation"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="leadId" render={({ field }) => (
                    <FormItem><FormLabel>Lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {leads?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem><FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {accounts?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="capacityKwp" render={({ field }) => (
                    <FormItem><FormLabel>Capacity (kWp)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Separator />
                <h3 className="font-medium">Cost Breakdown (₹)</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    ["panelCost", "Panel"], ["inverterCost", "Inverter"], ["structureCost", "Structure"], ["batteryCost", "Battery"],
                    ["cableCost", "Cable"], ["installationCost", "Installation"], ["civilWorksCost", "Civil Works"], ["otherCost", "Other"],
                  ].map(([name, label]) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contingencyPct" render={({ field }) => (
                    <FormItem><FormLabel>Contingency %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="marginPct" render={({ field }) => (
                    <FormItem><FormLabel>Margin %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>Save Estimation</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-48 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Per kWp</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimations?.length ? estimations.map(e => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setViewing(e)} data-testid={`row-estimation-${e.id}`}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell className="text-right">{e.capacityKwp} kWp</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(e.totalCost)}</TableCell>
                    <TableCell className="text-right">{formatINR(e.capacityKwp ? e.totalCost / e.capacityKwp : 0)}</TableCell>
                    <TableCell>{formatDate(e.createdAt)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No estimations yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-medium">{viewing.capacityKwp} kWp</p></div>
                  <div><p className="text-xs text-muted-foreground">Per kWp Cost</p><p className="font-medium">{formatINR(viewing.capacityKwp ? viewing.totalCost / viewing.capacityKwp : 0)}</p></div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <CostRow label="Panel" value={viewing.panelCost} />
                  <CostRow label="Inverter" value={viewing.inverterCost} />
                  <CostRow label="Structure" value={viewing.structureCost} />
                  <CostRow label="Battery" value={viewing.batteryCost} />
                  <CostRow label="Cable" value={viewing.cableCost} />
                  <CostRow label="Installation" value={viewing.installationCost} />
                  <CostRow label="Civil Works" value={viewing.civilWorksCost} />
                  <CostRow label="Other" value={viewing.otherCost} />
                  <Separator />
                  <CostRow label="Subtotal" value={viewing.subtotal} bold />
                  <CostRow label={`Contingency (${viewing.contingencyPct}%)`} value={viewing.contingencyAmount} />
                  <CostRow label={`Margin (${viewing.marginPct}%)`} value={viewing.marginAmount} />
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-bold">Grand Total</span>
                    <span className="text-xl font-bold text-primary">{formatINR(viewing.totalCost)}</span>
                  </div>
                </div>
                {viewing.notes && (<><Separator /><div><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm whitespace-pre-wrap">{viewing.notes}</p></div></>)}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => openEdit(viewing)} className="flex-1" data-testid="btn-edit-estimation">
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" data-testid="btn-delete-estimation"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Estimation?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(viewing.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CostRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useListEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate,
  getListEmailTemplatesQueryKey,
} from "@workspace/api-client-react";

const CATEGORIES = ["sales", "billing", "procurement", "operations", "expenses", "hr", "general"];

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useListEmailTemplates();
  const refresh = () => qc.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
  const [editing, setEditing] = useState<any | null>(null);

  const grouped = templates.reduce<Record<string, any[]>>((acc, t) => {
    const k = t.category || "general";
    if (!acc[k]) acc[k] = [];
    acc[k].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="page-title">Email Templates</h1>
        <TemplateDialog mode="create" onSaved={refresh} />
      </div>
      <p className="text-sm text-muted-foreground">
        Use double-curly placeholders like <code className="text-xs bg-muted px-1 rounded">{`{{customer.name}}`}</code>, <code className="text-xs bg-muted px-1 rounded">{`{{invoice.number}}`}</code>, <code className="text-xs bg-muted px-1 rounded">{`{{company.name}}`}</code>. Available context depends on the document type the email is sent against.
      </p>
      {isLoading ? <div>Loading...</div> : Object.keys(grouped).sort().map(cat => (
        <Card key={cat}>
          <CardContent className="pt-6 space-y-2">
            <h2 className="text-lg font-semibold capitalize">{cat}</h2>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Subject</TableHead><TableHead>Active</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {grouped[cat].map(t => (
                  <TableRow key={t.id} data-testid={`row-template-${t.id}`}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="text-sm">{t.subject}</TableCell>
                    <TableCell>{t.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                    <TableCell>{t.isSystem ? <Badge variant="outline">System</Badge> : <Badge variant="outline">Custom</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)} data-testid={`btn-edit-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {editing && <TemplateDialog mode="edit" template={editing} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} onSaved={refresh} />}
    </div>
  );
}

function TemplateDialog({ mode, template, open: controlledOpen, onOpenChange, onSaved }: { mode: "create" | "edit"; template?: any; open?: boolean; onOpenChange?: (v: boolean) => void; onSaved: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { toast } = useToast();
  const createMut = useCreateEmailTemplate();
  const updateMut = useUpdateEmailTemplate();
  const deleteMut = useDeleteEmailTemplate();
  const form = useForm<any>({ defaultValues: template ?? { isActive: true, category: "general" } });

  const submit = (values: any) => {
    const payload: any = { ...values };
    if (mode === "create") {
      createMut.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Template created" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
      });
    } else {
      const { code, isSystem, ...rest } = payload;
      updateMut.mutate({ id: template.id, data: rest }, {
        onSuccess: () => { toast({ title: "Template updated" }); setOpen(false); onSaved(); },
        onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
      });
    }
  };

  const onDelete = () => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    deleteMut.mutate({ id: template.id }, {
      onSuccess: () => { toast({ title: "Template deleted" }); setOpen(false); onSaved(); },
      onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" && <DialogTrigger asChild><Button data-testid="btn-new-template"><Plus className="h-4 w-4 mr-1.5" /> New Template</Button></DialogTrigger>}
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{mode === "create" ? "New Email Template" : `Edit: ${template?.name}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Name</Label><Input {...form.register("name")} data-testid="field-name" /></div>
            <div><Label>Code</Label><Input {...form.register("code")} disabled={mode === "edit"} data-testid="field-code" /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger data-testid="field-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Subject</Label><Input {...form.register("subject")} data-testid="field-subject" /></div>
          <div><Label>Body</Label><Textarea rows={12} {...form.register("body")} className="font-mono text-sm" data-testid="field-body" /></div>
          <div><Label>Available Variables (helper text)</Label><Input {...form.register("variables")} placeholder="customer.name, invoice.number, ..." /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ea" {...form.register("isActive")} className="h-4 w-4" />
            <Label htmlFor="ea" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          {mode === "edit" && !template?.isSystem && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>}
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={form.handleSubmit(submit)} data-testid="btn-save-template">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

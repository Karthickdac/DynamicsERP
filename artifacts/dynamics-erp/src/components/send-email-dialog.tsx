import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useListEmailTemplates,
  usePreviewEmailForEntity,
  useSendEmail,
} from "@workspace/api-client-react";

type Props = {
  entityType: string;
  entityId: number;
  entityLabel?: string;
  defaultTo?: string | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonSize?: "sm" | "default";
  category?: string;
};

export function SendEmailDialog({ entityType, entityId, entityLabel, defaultTo, triggerLabel = "Send Email", triggerVariant = "outline", buttonSize = "sm", category }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: templates } = useListEmailTemplates({ isActive: true });
  const filtered = (templates ?? []).filter(t => !category || t.category === category);
  const [templateId, setTemplateId] = useState<string>("");
  const [to, setTo] = useState<string>(defaultTo ?? "");
  const [cc, setCc] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");

  const previewMut = usePreviewEmailForEntity();
  const sendMut = useSendEmail();

  useEffect(() => {
    if (!open) return;
    if (!templateId && filtered.length) {
      setTemplateId(String(filtered[0].id));
    }
  }, [open, filtered, templateId]);

  useEffect(() => {
    if (!open || !templateId) return;
    previewMut.mutate({ data: { templateId: Number(templateId), entityType, entityId } }, {
      onSuccess: (r) => {
        setSubject(r.subject);
        setBody(r.body);
        if (!to && r.suggestedTo.length) setTo(r.suggestedTo.join(", "));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, open]);

  const handleSend = () => {
    const toList = to.split(",").map(s => s.trim()).filter(Boolean);
    const ccList = cc.split(",").map(s => s.trim()).filter(Boolean);
    if (!toList.length) { toast({ title: "Recipient required", description: "Please add at least one To address.", variant: "destructive" }); return; }
    if (!subject.trim() || !body.trim()) { toast({ title: "Subject and body required", variant: "destructive" }); return; }
    const tpl = filtered.find(t => String(t.id) === templateId);
    sendMut.mutate({
      data: {
        templateId: tpl?.id ?? null,
        templateCode: tpl?.code ?? null,
        entityType, entityId,
        to: toList, cc: ccList,
        subject, body,
      }
    }, {
      onSuccess: (r) => {
        toast({ title: r.status === "sent" ? "Email sent" : r.status === "skipped" ? "Email queued (SMTP not configured)" : "Email failed", description: r.message });
        if (r.status !== "failed") setOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "Failed to send email", description: err?.message ?? String(err), variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={buttonSize} data-testid="btn-send-email">
          <Mail className="h-4 w-4 mr-1.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Email{entityLabel ? ` — ${entityLabel}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger data-testid="select-template"><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>
                {filtered.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>To</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="comma-separated" data-testid="input-to" />
            </div>
            <div>
              <Label>CC</Label>
              <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="comma-separated (optional)" data-testid="input-cc" />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-subject" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="font-mono text-sm" data-testid="textarea-body" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sendMut.isPending} data-testid="btn-send">{sendMut.isPending ? "Sending..." : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

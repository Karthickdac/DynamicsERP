import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListIntegrations, useUpdateIntegration, useSyncMysticsHrStaff,
  getListIntegrationsQueryKey, getGetIntegrationQueryKey,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";

export default function IntegrationsPage() {
  const { data: list = [] } = useListIntegrations();
  const mh = list.find(i => i.provider === "mysticshr");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" data-testid="page-title">Integrations</h1>
      <p className="text-sm text-muted-foreground">Connect external systems. Save the API base URL and key, enable the connector, then run a sync from the relevant module.</p>
      <MysticsHrCard initial={mh} />
    </div>
  );
}

function MysticsHrCard({ initial }: { initial: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const updateMut = useUpdateIntegration();
  const syncMut = useSyncMysticsHrStaff();

  useEffect(() => {
    if (initial) {
      setEnabled(!!initial.enabled);
      setBaseUrl(initial.baseUrl ?? "");
    }
  }, [initial]);

  const onSave = () => {
    const payload: any = { enabled, baseUrl };
    if (apiKey) payload.apiKey = apiKey;
    updateMut.mutate({ provider: "mysticshr", data: payload }, {
      onSuccess: () => {
        toast({ title: "MysticsHR settings saved" });
        qc.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetIntegrationQueryKey("mysticshr") });
        setApiKey("");
      },
      onError: (err: any) => toast({ title: "Failed", description: err?.message, variant: "destructive" }),
    });
  };

  const onSync = () => {
    syncMut.mutate(undefined, {
      onSuccess: (r) => toast({ title: `Sync — ${r.status}`, description: r.message }),
      onError: (err: any) => toast({ title: "Sync failed", description: err?.message, variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>MysticsHR (HR Sync)</CardTitle>
          {initial?.lastSyncStatus && <Badge variant="outline">Last sync: {initial.lastSyncStatus} • {initial.lastSyncAt ? formatDate(initial.lastSyncAt) : "—"}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Imports staff records into DynamicsERP. The MysticsHR API endpoints will be wired in once the connector spec is provided. Save your credentials below; the manual sync from Staff &gt; Sync from MysticsHR will use them.</p>
        <div className="flex items-center gap-2">
          <input id="mh-enabled" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" data-testid="field-enabled" />
          <Label htmlFor="mh-enabled">Enable MysticsHR connector</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>API Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.mysticshr.com/v1" data-testid="field-baseUrl" />
          </div>
          <div>
            <Label>API Key {initial?.apiKeyMasked && <span className="text-xs text-muted-foreground ml-2">currently: {initial.apiKeyMasked}</span>}</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter to update" type="password" data-testid="field-apiKey" />
          </div>
        </div>
        {initial?.lastSyncMessage && (
          <div className="text-xs bg-muted/50 rounded p-2 border">
            <span className="font-medium">Last sync message:</span> {initial.lastSyncMessage}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={updateMut.isPending} data-testid="btn-save">{updateMut.isPending ? "Saving..." : "Save Settings"}</Button>
          <Button variant="outline" onClick={onSync} disabled={syncMut.isPending} data-testid="btn-sync">Run Sync Now</Button>
        </div>
      </CardContent>
    </Card>
  );
}

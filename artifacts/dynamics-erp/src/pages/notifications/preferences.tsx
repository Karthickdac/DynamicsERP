import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BellRing, BellOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotificationPreferences, getGetNotificationPreferencesQueryKey,
  useUpdateNotificationPreferences,
  useGetNotificationConfig,
  useSubscribePush, useUnsubscribePush,
} from "@workspace/api-client-react";
import type { NotificationPreference } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from "@/lib/push";

type PrefRow = NotificationPreference;

export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: serverPrefs } = useGetNotificationPreferences();
  const { data: config } = useGetNotificationConfig();
  const updateMutation = useUpdateNotificationPreferences();
  const subscribeMutation = useSubscribePush();
  const unsubscribeMutation = useUnsubscribePush();

  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    if (serverPrefs) setPrefs(serverPrefs);
  }, [serverPrefs]);

  useEffect(() => {
    if (!isPushSupported()) return;
    getCurrentSubscription().then((s) => setPushSubscribed(!!s));
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, PrefRow[]>();
    for (const p of prefs) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return Array.from(m.entries());
  }, [prefs]);

  const togglePref = (eventKey: string, channel: "inApp" | "email" | "push", value: boolean) => {
    setPrefs((prev) => prev.map((p) => (p.eventKey === eventKey ? { ...p, [channel]: value } : p)));
  };

  const handleSave = () => {
    updateMutation.mutate(
      { data: { preferences: prefs.map(({ eventKey, inApp, email, push }) => ({ eventKey, inApp, email, push })) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNotificationPreferencesQueryKey() });
          toast({ title: "Saved", description: "Notification preferences updated." });
        },
        onError: (err: any) => toast({ title: "Save failed", description: err?.message ?? String(err), variant: "destructive" }),
      },
    );
  };

  const handleEnablePush = async () => {
    if (!config?.vapidPublicKey) {
      toast({ title: "Push not configured", description: "VAPID keys are not set on the server.", variant: "destructive" });
      return;
    }
    try {
      const sub = await subscribeToPush(config.vapidPublicKey);
      if (!sub) {
        toast({ title: "Permission denied", description: "Browser push permission was not granted.", variant: "destructive" });
        return;
      }
      await subscribeMutation.mutateAsync({ data: sub });
      setPushSubscribed(true);
      toast({ title: "Push enabled", description: "You'll now receive browser push notifications." });
    } catch (e: any) {
      toast({ title: "Failed to subscribe", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const handleDisablePush = async () => {
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await unsubscribeMutation.mutateAsync({ params: { endpoint } });
      setPushSubscribed(false);
      toast({ title: "Push disabled" });
    } catch (e: any) {
      toast({ title: "Failed to unsubscribe", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const pushAvailable = isPushSupported() && config?.pushEnabled === true;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link href="/notifications"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold">Notification preferences</h1>
          <p className="text-sm text-muted-foreground">Choose how you want to be notified for each event.</p>
        </div>
      </div>

      {(!config?.emailEnabled || !pushAvailable) && (
        <Alert>
          <AlertTitle>Channel availability</AlertTitle>
          <AlertDescription className="space-y-1">
            {!config?.emailEnabled && <div>• Email is not configured on the server (set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM).</div>}
            {!config?.pushEnabled && <div>• Push is not configured on the server (set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).</div>}
            {config?.pushEnabled && !isPushSupported() && <div>• Your browser does not support push notifications.</div>}
            <div className="text-muted-foreground pt-1">In-app notifications work in all environments.</div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Browser push</CardTitle>
          <CardDescription>Receive native desktop / mobile notifications via the browser.</CardDescription>
        </CardHeader>
        <CardContent>
          {!pushAvailable && <p className="text-sm text-muted-foreground">Push not available.</p>}
          {pushAvailable && (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                Status: <Badge variant={pushSubscribed ? "default" : "secondary"}>{pushSubscribed ? "Subscribed" : "Not subscribed"}</Badge>
              </div>
              {pushSubscribed ? (
                <Button variant="outline" onClick={handleDisablePush} disabled={unsubscribeMutation.isPending} data-testid="btn-disable-push">
                  <BellOff className="h-4 w-4 mr-2" /> Disable browser push
                </Button>
              ) : (
                <Button onClick={handleEnablePush} disabled={subscribeMutation.isPending} data-testid="btn-enable-push">
                  <BellRing className="h-4 w-4 mr-2" /> Enable browser push
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {grouped.map(([category, rows]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left p-3 font-medium">Event</th>
                  <th className="p-3 w-24 font-medium">In-app</th>
                  <th className="p-3 w-24 font-medium">Email</th>
                  <th className="p-3 w-24 font-medium">Push</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.eventKey} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div className="font-medium">{r.eventLabel}</div>
                      <div className="text-xs text-muted-foreground">{r.eventKey}</div>
                    </td>
                    <td className="p-3 text-center">
                      <Switch checked={r.inApp} onCheckedChange={(v) => togglePref(r.eventKey, "inApp", v)} data-testid={`pref-${r.eventKey}-inApp`} />
                    </td>
                    <td className="p-3 text-center">
                      <Switch checked={r.email} disabled={!config?.emailEnabled} onCheckedChange={(v) => togglePref(r.eventKey, "email", v)} data-testid={`pref-${r.eventKey}-email`} />
                    </td>
                    <td className="p-3 text-center">
                      <Switch checked={r.push} disabled={!pushAvailable} onCheckedChange={(v) => togglePref(r.eventKey, "push", v)} data-testid={`pref-${r.eventKey}-push`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="btn-save-prefs">
          {updateMutation.isPending ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}

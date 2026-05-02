import { Link, useLocation } from "wouter";
import { CheckCheck, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications, getListNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
  useGetUnreadCount, getGetUnreadCountQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useListNotifications({ limit: 100 });
  const { data: unread } = useGetUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUnreadCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({ limit: 100 }) });
  };

  const handleClick = async (id: number, link: string | null | undefined, isRead: boolean) => {
    if (!isRead) await markRead.mutateAsync({ id }).catch(() => {});
    invalidate();
    if (link) setLocation(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread?.unread ?? 0} unread</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markAll.mutate(undefined, { onSuccess: invalidate })} data-testid="btn-mark-all-read-page">
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all as read
          </Button>
          <Button asChild variant="outline">
            <Link href="/notifications/preferences"><Settings className="h-4 w-4 mr-2" /> Preferences</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-6 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && items.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">No notifications yet</div>
          )}
          <ul className="divide-y">
            {items.map((n) => (
              <li
                key={n.id}
                className={`p-4 hover:bg-muted cursor-pointer ${n.isRead ? "" : "bg-blue-50/40 dark:bg-blue-950/20"}`}
                onClick={() => handleClick(n.id, n.link, n.isRead)}
                data-testid={`notif-row-${n.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      <Badge variant="outline" className="text-[10px]">{n.eventKey}</Badge>
                      {!n.isRead && <Badge variant="default" className="text-[10px]">New</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                    <div className="text-xs text-muted-foreground mt-1.5 flex gap-3">
                      <span>{formatDate(n.createdAt)}</span>
                      {n.emailStatus && <span>email: {n.emailStatus}</span>}
                      {n.pushStatus && <span>push: {n.pushStatus}</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

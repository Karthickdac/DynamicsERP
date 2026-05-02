import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUnreadCount, getGetUnreadCountQueryKey,
  useListNotifications, getListNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const unreadQuery = useGetUnreadCount({
    query: { queryKey: getGetUnreadCountQueryKey(), enabled: isAuthenticated, refetchInterval: 30000, staleTime: 15000 },
  });
  const listQuery = useListNotifications({ limit: 20 }, {
    query: { queryKey: getListNotificationsQueryKey({ limit: 20 }), enabled: isAuthenticated && open, staleTime: 5000 },
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const unread = unreadQuery.data?.unread ?? 0;
  const items = listQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUnreadCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({ limit: 20 }) });
  };

  const handleItemClick = async (id: number, link: string | null | undefined, isRead: boolean) => {
    if (!isRead) await markReadMutation.mutateAsync({ id }).catch(() => {});
    invalidate();
    setOpen(false);
    if (link) setLocation(link);
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="btn-notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-[10px]"
              data-testid="notif-unread-badge"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-medium">Notifications</span>
            {unread > 0 && <Badge variant="secondary">{unread} unread</Badge>}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllMutation.mutate(undefined, { onSuccess: invalidate })} data-testid="btn-mark-all-read">
                <CheckCheck className="h-4 w-4 mr-1" /> Read all
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setLocation("/notifications/preferences"); }} data-testid="btn-notif-prefs">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {listQuery.isLoading && <div className="p-6 text-sm text-muted-foreground text-center">Loading...</div>}
          {!listQuery.isLoading && items.length === 0 && (
            <div className="p-8 text-sm text-muted-foreground text-center">No notifications yet</div>
          )}
          <ul>
            {items.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-3 border-b last:border-b-0 hover:bg-muted cursor-pointer ${n.isRead ? "" : "bg-blue-50/40 dark:bg-blue-950/20"}`}
                onClick={() => handleItemClick(n.id, n.link, n.isRead)}
                data-testid={`notif-item-${n.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</div>
                  </div>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="p-2 border-t">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

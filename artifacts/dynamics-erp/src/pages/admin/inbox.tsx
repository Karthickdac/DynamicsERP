import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Inbox as InboxIcon,
  RefreshCw,
  Paperclip,
  Mail,
  MailOpen,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useListInboxMessages,
  useGetInboxMessage,
  getListInboxMessagesQueryKey,
  getGetInboxMessageQueryKey,
} from "@workspace/api-client-react";

function formatDate(s: string | null | undefined) {
  if (!s) return "";
  try {
    return format(new Date(s), "MMM d, h:mm a");
  } catch {
    return s;
  }
}

export default function InboxPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUid, setSelectedUid] = useState<number | null>(null);

  const listQuery = useListInboxMessages(
    { limit: 50 },
    { query: { retry: false, queryKey: getListInboxMessagesQueryKey({ limit: 50 }) } },
  );

  const errorMessage =
    listQuery.error && listQuery.error instanceof Error
      ? (listQuery.error.message ?? "Failed to load inbox.")
      : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListInboxMessagesQueryKey({ limit: 50 }) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <InboxIcon className="h-6 w-6" /> Inbox
          </h1>
          {listQuery.data && (
            <Badge variant="secondary" data-testid="inbox-stats">
              {listQuery.data.unseen} unread / {listQuery.data.total} total
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={listQuery.isFetching}
          data-testid="btn-refresh-inbox"
        >
          {listQuery.isFetching ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Reads messages from the configured IMAP mailbox. Configure IMAP credentials in{" "}
        <a className="underline" href="/admin/email-settings">
          Email Settings
        </a>
        .
      </p>

      {errorMessage && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div data-testid="inbox-error">
              <div className="font-medium">Could not read inbox.</div>
              <div className="text-muted-foreground">{errorMessage}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUid !== null ? (
        <MessageView
          uid={selectedUid}
          onClose={() => {
            setSelectedUid(null);
            refresh();
          }}
          onError={(msg) => toast({ title: "Failed to load message", description: msg, variant: "destructive" })}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent messages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listQuery.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : listQuery.data && listQuery.data.messages.length > 0 ? (
              <ul className="divide-y" data-testid="inbox-list">
                {listQuery.data.messages.map((m) => (
                  <li
                    key={m.uid}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer ${
                      m.seen ? "" : "bg-primary/5"
                    }`}
                    onClick={() => setSelectedUid(m.uid)}
                    data-testid={`inbox-row-${m.uid}`}
                  >
                    {m.seen ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className={`truncate ${m.seen ? "" : "font-semibold"}`}>
                          {m.fromName || m.fromAddress || "(unknown sender)"}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatDate(m.date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm truncate">
                        <span className={`truncate ${m.seen ? "text-muted-foreground" : ""}`}>
                          {m.subject || "(no subject)"}
                        </span>
                        {m.hasAttachments && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !errorMessage ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No messages in this mailbox.
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessageView({
  uid,
  onClose,
  onError,
}: {
  uid: number;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const messageQuery = useGetInboxMessage(uid, {
    query: { retry: false, queryKey: getGetInboxMessageQueryKey(uid) },
  });

  if (messageQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (messageQuery.error) {
    const msg = messageQuery.error instanceof Error ? messageQuery.error.message : "Failed";
    onError(msg);
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <div className="text-sm text-destructive">{msg}</div>
        </CardContent>
      </Card>
    );
  }

  const m = messageQuery.data;
  if (!m) return null;

  return (
    <Card data-testid="message-view">
      <CardHeader className="space-y-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to inbox
          </Button>
        </div>
        <CardTitle className="text-lg" data-testid="message-subject">
          {m.subject || "(no subject)"}
        </CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>
            <span className="font-medium">From:</span>{" "}
            {m.fromName ? `${m.fromName} <${m.fromAddress ?? ""}>` : m.fromAddress || "(unknown)"}
          </div>
          {m.toAddresses.length > 0 && (
            <div>
              <span className="font-medium">To:</span> {m.toAddresses.join(", ")}
            </div>
          )}
          {m.ccAddresses.length > 0 && (
            <div>
              <span className="font-medium">Cc:</span> {m.ccAddresses.join(", ")}
            </div>
          )}
          {m.date && (
            <div>
              <span className="font-medium">Date:</span> {formatDate(m.date)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {m.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-4 w-4" /> Attachments:
            </span>
            {m.attachments.map((a, i) => (
              <Badge key={i} variant="outline" data-testid={`attachment-${i}`}>
                {a.filename || `attachment-${i + 1}`}
                <span className="ml-1 text-muted-foreground">
                  ({Math.max(1, Math.round(a.size / 1024))} KB)
                </span>
              </Badge>
            ))}
          </div>
        )}
        {m.html ? (
          <iframe
            srcDoc={m.html}
            className="w-full min-h-[500px] border rounded"
            sandbox=""
            title="Email body"
            data-testid="message-html"
          />
        ) : m.text ? (
          <pre
            className="whitespace-pre-wrap text-sm font-sans bg-muted/30 p-4 rounded border"
            data-testid="message-text"
          >
            {m.text}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground">(empty message body)</div>
        )}
      </CardContent>
    </Card>
  );
}

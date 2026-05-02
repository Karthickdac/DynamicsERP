import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApprovalRequests,
  getListApprovalRequestsQueryKey,
  useApproveApprovalRequest,
  useRejectApprovalRequest,
  ApprovalRequest,
  ListApprovalRequestsParams,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { CheckSquare, Check, X, FileText, Settings } from "lucide-react";

function statusBadge(status: string) {
  if (status === "approved") return <Badge variant="default" className="bg-green-600 hover:bg-green-600">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending") return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</Badge>;
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

function RequestList({ params, allowAction, onAction }: { params: ListApprovalRequestsParams; allowAction: boolean; onAction: (req: ApprovalRequest, type: "approve" | "reject") => void }) {
  const { data: requests, isLoading } = useListApprovalRequests(params, {
    query: { queryKey: getListApprovalRequestsQueryKey(params) },
  });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!requests?.length) return <p className="text-center py-8 text-muted-foreground">No requests.</p>;

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <Card key={req.id}>
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {req.entityType === "quotation" && (
                  <Link href={`/quotations/${req.entityId}`} className="text-primary hover:underline font-medium flex items-center gap-1" data-testid={`link-request-${req.id}`}>
                    <FileText className="w-4 h-4" /> {req.entityTitle || `Quotation #${req.entityId}`}
                  </Link>
                )}
                {statusBadge(req.status)}
                <Badge variant="outline">Level {req.level}</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>Amount: <span className="font-medium text-foreground">{formatINR(req.amount)}</span></span>
                <span>Approver: <span className="font-medium text-foreground capitalize">{req.approverRole.replace("_", " ")}</span> {req.approverName ? `(${req.approverName})` : ""}</span>
                {req.actionedAt && <span>Actioned {formatDate(req.actionedAt)}</span>}
              </div>
              {req.comments && <p className="text-sm pt-1 italic">"{req.comments}"</p>}
            </div>
            {allowAction && req.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onAction(req, "approve")} data-testid={`btn-inbox-approve-${req.id}`}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction(req, "reject")} data-testid={`btn-inbox-reject-${req.id}`}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Approvals() {
  const [tab, setTab] = useState("inbox");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actionRequest, setActionRequest] = useState<{ req: ApprovalRequest; type: "approve" | "reject" } | null>(null);
  const [comments, setComments] = useState("");

  const approveMutation = useApproveApprovalRequest();
  const rejectMutation = useRejectApprovalRequest();

  const onAction = (req: ApprovalRequest, type: "approve" | "reject") => {
    setActionRequest({ req, type });
    setComments("");
  };

  const submit = () => {
    if (!actionRequest) return;
    const mut = actionRequest.type === "approve" ? approveMutation : rejectMutation;
    mut.mutate({ id: actionRequest.req.id, data: { comments: comments || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApprovalRequestsQueryKey() });
        setActionRequest(null);
        toast({ title: actionRequest.type === "approve" ? "Approved" : "Rejected" });
      },
    });
  };

  return (
    <div className="space-y-6" data-testid="page-approvals">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><CheckSquare className="h-6 w-6" /> Approvals</h1>
          <p className="text-muted-foreground">Review and act on pending approval requests.</p>
        </div>
        <Link href="/approvals/rules">
          <Button variant="outline" data-testid="link-approval-rules"><Settings className="w-4 h-4 mr-2" /> Manage Rules</Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox" data-testid="tab-inbox">My Inbox</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-pending">All Pending</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-history-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-history-rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <RequestList params={{ assignedToMe: true, status: "pending" }} allowAction onAction={onAction} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <RequestList params={{ status: "pending" }} allowAction={false} onAction={onAction} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <RequestList params={{ status: "approved" }} allowAction={false} onAction={onAction} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <RequestList params={{ status: "rejected" }} allowAction={false} onAction={onAction} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!actionRequest} onOpenChange={(o) => !o && setActionRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionRequest?.type === "approve" ? "Approve" : "Reject"} Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
            <Button onClick={submit} disabled={approveMutation.isPending || rejectMutation.isPending} className="w-full" data-testid="btn-confirm-action">
              Confirm {actionRequest?.type === "approve" ? "Approval" : "Rejection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

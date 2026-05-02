import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject, getGetProjectQueryKey, useUpdateProject, useAdvanceProjectStage,
  useCreateProjectTask, useUpdateProjectTask,
  useAddProjectTeamMember, useRemoveProjectTeamMember,
  useCreateSiteSurvey, useListSiteSurveys, getListSiteSurveysQueryKey,
  useUpdateProjectMilestone,
  useListUsers,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatDate } from "@/lib/format";
import { HardHat, ArrowRight, Plus, Trash2, CheckCircle2, Clock, Circle, FileText, ShoppingCart, MapPin } from "lucide-react";

const STAGES = ["site_survey", "design", "procurement", "installation", "testing", "commissioning", "handover", "cancelled"] as const;
const STAGE_LABEL: Record<string, string> = {
  site_survey: "Site Survey", design: "Design", procurement: "Procurement",
  installation: "Installation", testing: "Testing", commissioning: "Commissioning",
  handover: "Handover", cancelled: "Cancelled",
};
const NEXT_STAGE: Record<string, string | null> = {
  site_survey: "design", design: "procurement", procurement: "installation",
  installation: "testing", testing: "commissioning", commissioning: "handover",
  handover: null, cancelled: null,
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) },
  });
  const { data: surveys } = useListSiteSurveys(id, {
    query: { enabled: !!id, queryKey: getListSiteSurveysQueryKey(id) },
  });
  const { data: users } = useListUsers();

  const updateMutation = useUpdateProject();
  const advanceMutation = useAdvanceProjectStage();
  const createTaskMutation = useCreateProjectTask();
  const updateTaskMutation = useUpdateProjectTask();
  const addTeamMutation = useAddProjectTeamMember();
  const removeTeamMutation = useRemoveProjectTeamMember();
  const createSurveyMutation = useCreateSiteSurvey();
  const updateMilestoneMutation = useUpdateProjectMilestone();

  const [taskForm, setTaskForm] = useState({ title: "", description: "", assigneeId: "_none", dueDate: "", priority: "medium" });
  const [taskOpen, setTaskOpen] = useState(false);
  const [memberId, setMemberId] = useState("_none");
  const [memberRole, setMemberRole] = useState("engineer");
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ surveyDate: new Date().toISOString().slice(0,10), surveyorId: "_none", roofType: "", roofAreaSqft: "", recommendedCapacityKwp: "", shadowAnalysis: "", loadDetails: "", existingMeterDetails: "", notes: "" });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListSiteSurveysQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  const onAdvance = () => {
    if (!project) return;
    const next = NEXT_STAGE[project.stage];
    if (!next) return;
    advanceMutation.mutate({ id, data: { stage: next as any } }, {
      onSuccess: () => { toast({ title: `Advanced to ${STAGE_LABEL[next]}` }); refetch(); },
      onError: () => toast({ title: "Failed to advance stage", variant: "destructive" }),
    });
  };

  const onAddTask = () => {
    if (!taskForm.title) { toast({ title: "Title required", variant: "destructive" }); return; }
    createTaskMutation.mutate({
      id,
      data: {
        title: taskForm.title,
        description: taskForm.description || null,
        assigneeId: taskForm.assigneeId !== "_none" ? Number(taskForm.assigneeId) : null,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        priority: taskForm.priority,
      },
    }, {
      onSuccess: () => { toast({ title: "Task added" }); refetch(); setTaskOpen(false); setTaskForm({ title: "", description: "", assigneeId: "_none", dueDate: "", priority: "medium" }); },
    });
  };

  const onAddMember = () => {
    if (memberId === "_none") return;
    addTeamMutation.mutate({ id, data: { userId: Number(memberId), role: memberRole } }, {
      onSuccess: () => { toast({ title: "Member added" }); refetch(); setMemberId("_none"); },
      onError: () => toast({ title: "Failed (already on team?)", variant: "destructive" }),
    });
  };

  const onRemoveMember = (memberRowId: number) => {
    removeTeamMutation.mutate({ id, memberId: memberRowId }, { onSuccess: () => refetch() });
  };

  const onAddSurvey = () => {
    createSurveyMutation.mutate({
      id,
      data: {
        surveyDate: new Date(surveyForm.surveyDate).toISOString(),
        surveyorId: surveyForm.surveyorId !== "_none" ? Number(surveyForm.surveyorId) : null,
        roofType: surveyForm.roofType || null,
        roofAreaSqft: surveyForm.roofAreaSqft ? Number(surveyForm.roofAreaSqft) : null,
        recommendedCapacityKwp: surveyForm.recommendedCapacityKwp ? Number(surveyForm.recommendedCapacityKwp) : null,
        shadowAnalysis: surveyForm.shadowAnalysis || null,
        loadDetails: surveyForm.loadDetails || null,
        existingMeterDetails: surveyForm.existingMeterDetails || null,
        notes: surveyForm.notes || null,
      },
    }, {
      onSuccess: () => { toast({ title: "Survey logged" }); refetch(); setSurveyOpen(false); },
    });
  };

  const onToggleTask = (taskId: number, status: string) => {
    const newStatus = status === "completed" ? "todo" : "completed";
    updateTaskMutation.mutate({ id, taskId, data: { status: newStatus } }, { onSuccess: () => refetch() });
  };

  const onUpdateMilestone = (milestoneId: number, status: string) => {
    updateMilestoneMutation.mutate({
      id, milestoneId,
      data: { status, actualDate: status === "completed" ? new Date().toISOString() : null },
    }, { onSuccess: () => refetch() });
  };

  if (isLoading || !project) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;

  const milestones = project.milestones ?? [];
  const tasks = project.tasks ?? [];
  const team = project.team ?? [];
  const next = NEXT_STAGE[project.stage];
  const memberUserIds = new Set(team.map(t => t.userId));
  const availableUsers = users?.filter(u => !memberUserIds.has(u.id)) ?? [];

  return (
    <div className="space-y-6" data-testid="page-project-detail">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><HardHat className="h-6 w-6" /> {project.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
            <span className="font-mono text-muted-foreground">{project.projectNumber}</span>
            <Badge variant="outline">{STAGE_LABEL[project.stage]}</Badge>
            {project.salesOrderId && (
              <Link href={`/sales-orders/${project.salesOrderId}`} className="text-primary hover:underline flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" /> {project.salesOrderNumber}
              </Link>
            )}
          </div>
        </div>
        {next && (
          <Button onClick={onAdvance} disabled={advanceMutation.isPending} data-testid="btn-advance-stage">
            Advance to {STAGE_LABEL[next]} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Project Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Account</p><p className="font-medium">{project.accountName || "-"}</p></div>
              <div><p className="text-muted-foreground">Manager</p><p className="font-medium">{project.managerName || "-"}</p></div>
              <div><p className="text-muted-foreground">Capacity</p><p className="font-medium">{project.capacityKwp != null ? `${project.capacityKwp} kWp` : "-"}</p></div>
              <div><p className="text-muted-foreground">Budget</p><p className="font-medium">{project.budget != null ? formatINR(project.budget) : "-"}</p></div>
              <div><p className="text-muted-foreground">Start Date</p><p className="font-medium">{formatDate(project.startDate)}</p></div>
              <div><p className="text-muted-foreground">Expected End</p><p className="font-medium">{formatDate(project.expectedEndDate)}</p></div>
            </div>
            {project.siteAddress && (
              <div className="text-sm pt-2 border-t">
                <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Site</p>
                <p className="font-medium">{project.siteAddress}, {project.siteCity}, {project.siteState} {project.sitePincode}</p>
              </div>
            )}
            {project.description && <p className="text-sm pt-2 border-t whitespace-pre-line">{project.description}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Team</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {team.length ? team.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm" data-testid={`team-member-${t.id}`}>
                  <div>
                    <p className="font-medium">{t.userName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.role}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveMember(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">No members yet.</p>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger data-testid="select-member-user"><SelectValue placeholder="Add member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(select user)</SelectItem>
                  {availableUsers.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="electrician">Electrician</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={onAddMember} disabled={memberId === "_none" || addTeamMutation.isPending} className="w-full" size="sm" data-testid="btn-add-member"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="milestones">
        <TabsList>
          <TabsTrigger value="milestones" data-testid="tab-milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="surveys" data-testid="tab-surveys">Site Surveys</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones">
          <Card>
            <CardHeader><CardTitle>Project Milestones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded" data-testid={`milestone-${m.id}`}>
                  <div className="flex items-center gap-3">
                    {m.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : m.status === "in_progress" ? <Clock className="w-5 h-5 text-yellow-600" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Stage: {STAGE_LABEL[m.stage] ?? m.stage} {m.actualDate && `· Completed ${formatDate(m.actualDate)}`}</p>
                    </div>
                  </div>
                  <Select value={m.status} onValueChange={(v) => onUpdateMilestone(m.id, v)}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tasks</CardTitle>
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="btn-new-task"><Plus className="w-4 h-4 mr-1" /> New Task</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-2"><Label>Title *</Label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} data-testid="input-task-title" /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Assignee</Label>
                        <Select value={taskForm.assigneeId} onValueChange={(v) => setTaskForm({ ...taskForm, assigneeId: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">(none)</SelectItem>
                            {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Priority</Label>
                        <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
                    <Button onClick={onAddTask} disabled={createTaskMutation.isPending} data-testid="btn-create-task">Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length ? tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded" data-testid={`task-${t.id}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => onToggleTask(t.id, t.status)}>
                      {t.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    <div>
                      <p className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.assigneeName ?? "Unassigned"} · Due {formatDate(t.dueDate)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{t.priority}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surveys">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Site Surveys</CardTitle>
              <Dialog open={surveyOpen} onOpenChange={setSurveyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="btn-new-survey"><Plus className="w-4 h-4 mr-1" /> New Survey</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle>Site Survey</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Date *</Label><Input type="date" value={surveyForm.surveyDate} onChange={(e) => setSurveyForm({ ...surveyForm, surveyDate: e.target.value })} data-testid="input-survey-date" /></div>
                      <div className="space-y-2"><Label>Surveyor</Label>
                        <Select value={surveyForm.surveyorId} onValueChange={(v) => setSurveyForm({ ...surveyForm, surveyorId: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">(none)</SelectItem>
                            {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Roof Type</Label>
                        <Select value={surveyForm.roofType || "_none"} onValueChange={(v) => setSurveyForm({ ...surveyForm, roofType: v === "_none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">(none)</SelectItem>
                            <SelectItem value="rcc">RCC</SelectItem>
                            <SelectItem value="metal">Metal Sheet</SelectItem>
                            <SelectItem value="tile">Tile</SelectItem>
                            <SelectItem value="ground">Ground Mount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Roof Area (sqft)</Label><Input type="number" value={surveyForm.roofAreaSqft} onChange={(e) => setSurveyForm({ ...surveyForm, roofAreaSqft: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Recommended kWp</Label><Input type="number" step="0.1" value={surveyForm.recommendedCapacityKwp} onChange={(e) => setSurveyForm({ ...surveyForm, recommendedCapacityKwp: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Shadow Analysis</Label><Textarea value={surveyForm.shadowAnalysis} onChange={(e) => setSurveyForm({ ...surveyForm, shadowAnalysis: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Load Details</Label><Textarea value={surveyForm.loadDetails} onChange={(e) => setSurveyForm({ ...surveyForm, loadDetails: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Existing Meter Details</Label><Textarea value={surveyForm.existingMeterDetails} onChange={(e) => setSurveyForm({ ...surveyForm, existingMeterDetails: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Notes</Label><Textarea value={surveyForm.notes} onChange={(e) => setSurveyForm({ ...surveyForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSurveyOpen(false)}>Cancel</Button>
                    <Button onClick={onAddSurvey} disabled={createSurveyMutation.isPending} data-testid="btn-create-survey">Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {surveys?.length ? surveys.map(s => (
                <div key={s.id} className="p-3 border rounded text-sm space-y-1" data-testid={`survey-${s.id}`}>
                  <div className="flex justify-between">
                    <p className="font-medium">{formatDate(s.surveyDate)} — {s.surveyorName ?? "Unknown"}</p>
                    <Badge variant="outline" className="capitalize">{s.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span><span className="text-muted-foreground">Roof: </span>{s.roofType ?? "-"}</span>
                    <span><span className="text-muted-foreground">Area: </span>{s.roofAreaSqft ? `${s.roofAreaSqft} sqft` : "-"}</span>
                    <span><span className="text-muted-foreground">Recommended: </span>{s.recommendedCapacityKwp ? `${s.recommendedCapacityKwp} kWp` : "-"}</span>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground pt-1 whitespace-pre-line">{s.notes}</p>}
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">No surveys logged.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

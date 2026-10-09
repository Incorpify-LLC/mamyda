import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectTaskBoard } from "@/components/project-task-board";
import { ContentProtection } from "@/components/content-protection";
import { encryptPrivateContent } from "@/lib/content-crypto";
import { LLMEditButton } from "@/components/llm-edit-button";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileField } from "@/components/turnstile-field";
import { PRIORITIES, TASK_COLUMNS } from "@/lib/columns";
import { deleteTask, moveTask, upsertTask } from "@/lib/mamyda/workspace";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { formatDay } from "@/lib/time";
import type { Task } from "@/lib/mamyda/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/board")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.clientId === "string" ? { clientId: search.clientId } : {}),
    ...(typeof search.projectId === "string" ? { projectId: search.projectId } : {}),
    ...(typeof search.taskId === "string" ? { taskId: search.taskId } : {}),
  }),
  component: BoardPage,
});

function priorityTone(p: string) {
  if (p === "urgent") return "danger" as const;
  if (p === "high") return "warn" as const;
  return "muted" as const;
}

function BoardPage() {
  const search = Route.useSearch();
  const ws = useWorkspace();
  const [clientId, setClientId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [task, setTask] = useState<Partial<Task> | null>(null);
  const [allProjectsView, setAllProjectsView] = useState(false);
  const [workloadClient, setWorkloadClient] = useState("all");
  const [workloadStatus, setWorkloadStatus] = useState("all");
  const [workloadPriority, setWorkloadPriority] = useState("all");
  const [workloadDue, setWorkloadDue] = useState("all");

  const clients = ws.data?.clients ?? [];
  const projects = ws.data?.projects ?? [];
  const tasks = ws.data?.tasks ?? [];

  useEffect(() => {
    if (!ws.data) return;
    if (search.clientId) setClientId(search.clientId);
    if (search.projectId) setProjectId(search.projectId);
    if (search.taskId) {
      const match = ws.data.tasks.find((item) => item.id === search.taskId);
      if (match) setTask(match);
    }
  }, [ws.data, search.clientId, search.projectId, search.taskId]);

  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : clients[0];
  const clientProjects = projects.filter((p) => p.clientId === selectedClient?.id);
  const selectedProject = projectId
    ? (clientProjects.find((p) => p.id === projectId) ?? clientProjects[0])
    : clientProjects[0];
  const boardTasks = tasks.filter((t) => t.projectId === selectedProject?.id);
  const activeClients = clients.filter((client) => !client.archived);
  const activeProjects = projects.filter(
    (project) =>
      !project.archived && activeClients.some((client) => client.id === project.clientId),
  );
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const workloadTasks = tasks
    .filter((item) => {
      if (!activeProjectIds.has(item.projectId)) return false;
      if (
        workloadClient !== "all" &&
        activeProjects.find((project) => project.id === item.projectId)?.clientId !== workloadClient
      )
        return false;
      if (workloadStatus !== "all" && item.columnId !== workloadStatus) return false;
      if (workloadPriority !== "all" && item.priority !== workloadPriority) return false;
      if (workloadDue === "due" && (!item.dueAt || item.columnId === "done")) return false;
      if (
        workloadDue === "overdue" &&
        (!item.dueAt || new Date(item.dueAt) >= new Date() || item.columnId === "done")
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.title.localeCompare(b.title);
    });

  async function refresh() {
    await ws.refetch();
  }

  return (
    <AppShell
      boardContext={
        allProjectsView
          ? {}
          : { clientId: clientId ?? undefined, projectId: projectId ?? undefined }
      }
      title="Board"
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Manage client and project details in{" "}
        <Link to="/clients" className="underline">
          Clients/Projects
        </Link>
        . Use Files for attachments.
      </p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Board view">
        <Button
          size="sm"
          variant={!allProjectsView ? "default" : "outline"}
          aria-pressed={!allProjectsView}
          onClick={() => setAllProjectsView(false)}
        >
          Project board
        </Button>
        <Button
          size="sm"
          variant={allProjectsView ? "default" : "outline"}
          aria-pressed={allProjectsView}
          onClick={() => setAllProjectsView(true)}
        >
          All projects
        </Button>
      </div>
      {!allProjectsView && (
        <div className="mb-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="board-client">
                Client
              </Label>
              <select
                id="board-client"
                aria-label="Select client"
                className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm"
                value={selectedClient?.id ?? ""}
                onChange={(event) => {
                  setClientId(event.target.value || null);
                  setProjectId(null);
                }}
              >
                {clients.length === 0 && <option value="">No clients yet</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="board-project">
                Project
              </Label>
              <select
                id="board-project"
                aria-label="Select project"
                className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm"
                value={selectedProject?.id ?? ""}
                disabled={!selectedClient}
                onChange={(event) => setProjectId(event.target.value || null)}
              >
                {clientProjects.length === 0 && <option value="">No projects yet</option>}
                {clientProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {allProjectsView ? (
        <section aria-label="All project tasks">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Label className="space-y-1 text-xs text-muted-foreground">
              Client
              <select
                aria-label="Filter by client"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={workloadClient}
                onChange={(e) => setWorkloadClient(e.target.value)}
              >
                <option value="all">All clients</option>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="space-y-1 text-xs text-muted-foreground">
              Status
              <select
                aria-label="Filter by status"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={workloadStatus}
                onChange={(e) => setWorkloadStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                {TASK_COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="space-y-1 text-xs text-muted-foreground">
              Priority
              <select
                aria-label="Filter by priority"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={workloadPriority}
                onChange={(e) => setWorkloadPriority(e.target.value)}
              >
                <option value="all">All priorities</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="space-y-1 text-xs text-muted-foreground">
              Due date
              <select
                aria-label="Filter by due date"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={workloadDue}
                onChange={(e) => setWorkloadDue(e.target.value)}
              >
                <option value="all">Any due date</option>
                <option value="due">Has due date</option>
                <option value="overdue">Overdue</option>
              </select>
            </Label>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {workloadTasks.length} task{workloadTasks.length === 1 ? "" : "s"} across{" "}
            {activeProjects.length} active projects
          </p>
          {workloadTasks.length ? (
            <div className="space-y-2">
              {workloadTasks.map((item) => {
                const project = activeProjects.find((entry) => entry.id === item.projectId);
                const client = activeClients.find((entry) => entry.id === project?.clientId);
                const overdue = Boolean(
                  item.dueAt && new Date(item.dueAt) < new Date() && item.columnId !== "done",
                );
                return (
                  <Card
                    key={item.id}
                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => setTask(item)}
                      className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open task ${item.title}`}
                    >
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.encrypted && (
                        <span className="block text-xs text-muted-foreground">
                          🔒 Content encrypted
                        </span>
                      )}
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {client?.name ?? "Client"} · {project?.name ?? "Project"}
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                      {item.dueAt && (
                        <Badge tone={overdue ? "danger" : "muted"}>
                          {overdue ? "Overdue · " : "Due · "}
                          {formatDay(item.dueAt)}
                        </Badge>
                      )}
                      <select
                        aria-label={`Move ${item.title} to status`}
                        value={item.columnId}
                        className="h-9 min-w-32 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                        onChange={async (e) => {
                          await moveTask({
                            data: { id: item.id, columnId: e.target.value, position: Date.now() },
                          });
                          await refresh();
                        }}
                      >
                        {TASK_COLUMNS.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No tasks match these filters. Try another filter or add work from a project board.
            </Card>
          )}
        </section>
      ) : selectedProject ? (
        <ProjectTaskBoard
          tasks={boardTasks}
          onOpen={setTask}
          onCreate={(columnId) =>
            setTask({
              projectId: selectedProject.id,
              columnId,
              priority: "normal",
              title: "",
            })
          }
          onMove={async (id, columnId) => {
            await moveTask({ data: { id, columnId, position: Date.now() } });
            await refresh();
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a client, then a project, then the work.
        </p>
      )}

      <TaskDialog task={task} onClose={() => setTask(null)} onSaved={refresh} />
    </AppShell>
  );
}

function TaskDialog({
  task,
  onClose,
  onSaved,
}: {
  task: Partial<Task> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const ws = useWorkspace();
  const [encryptContent, setEncryptContent] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [llmBusy, setLLMBusy] = useState(false);
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const open = Boolean(task);
  const isNew = !task?.id;

  useEffect(() => {
    if (!task) {
      setNotes("");
      setBaseline("");
      setUnlocked(false);
      return;
    }
    setTitle(task.title ?? "");
    setNotes(task.notes ?? "");
    setBaseline(task.notes ?? "");
    setEncryptContent(Boolean(task.encrypted));
    setUnlocked(false);
    setPriority(task.priority ?? "normal");
    setDueAt(task.dueAt ? task.dueAt.slice(0, 16) : "");
  }, [task]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !llmBusy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{isNew ? "New task" : "Task"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!task?.projectId || llmBusy) return;
            try {
              const encryption =
                encryptContent && (!task.encrypted || unlocked)
                  ? await encryptPrivateContent(notes, ws.data?.profile.vaultPublicKey)
                  : undefined;
              await upsertTask({
                data: {
                  id: task.id,
                  projectId: task.projectId,
                  title,
                  notes: encryptContent ? undefined : notes,
                  encryption,
                  labels: task.labels,
                  columnId: task.columnId,
                  priority,
                  dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                },
                headers: captcha ? { "x-turnstile-response": captcha } : undefined,
              });
              setCaptcha("");
              setCaptchaKey((value) => value + 1);
              toast.success("Task saved");
              onClose();
              onSaved();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not save task");
            } finally {
              setCaptcha("");
              setCaptchaKey((value) => value + 1);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ttitle">Title</Label>
            <Input id="ttitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tnotes">Notes</Label>
            <ContentProtection
              disabled={llmBusy}
              key={task?.id || "new-task"}
              profile={ws.data?.profile}
              kind="task"
              id={task?.id}
              encrypted={Boolean(task?.encrypted)}
              enabled={encryptContent}
              unlocked={unlocked}
              onToggle={setEncryptContent}
              onUnlock={(body) => {
                setNotes(body);
                setBaseline(body);
                setUnlocked(true);
              }}
              onLock={() => {
                if (
                  notes !== baseline &&
                  !window.confirm("Discard unsaved changes and lock this task?")
                )
                  return;
                setNotes("");
                setBaseline("");
                setUnlocked(false);
              }}
            />
            <Textarea
              id="tnotes"
              value={notes}
              disabled={llmBusy || (Boolean(task?.encrypted) && !unlocked)}
              placeholder={
                task?.encrypted && !unlocked ? "Encrypted content — unlock to view" : "Task content"
              }
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpri">Priority</Label>
              <select
                id="tpri"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tdue">Due</Label>
              <Input
                id="tdue"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <LLMEditButton
              title={title}
              body={notes}
              kind="spellcheck"
              label="Correct spelling with LLM"
              disabled={llmBusy || (Boolean(task?.encrypted) && !unlocked)}
              onBusyChange={setLLMBusy}
              onEdited={setNotes}
            />
            {task?.id && (
              <Button
                type="button"
                variant="ghost"
                disabled={llmBusy}
                onClick={async () => {
                  await deleteTask({
                    data: task.id!,
                    headers: captcha ? { "x-turnstile-response": captcha } : undefined,
                  });
                  onClose();
                  onSaved();
                }}
              >
                Delete
              </Button>
            )}
            <Button type="submit" disabled={llmBusy} className="ml-auto">
              Save
            </Button>
          </div>
          <TurnstileField action="task-manage" resetKey={captchaKey} onToken={setCaptcha} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

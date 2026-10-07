import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { AppShell, colorDot } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileField } from "@/components/turnstile-field";
import { CLIENT_COLORS, PRIORITIES, TASK_COLUMNS } from "@/lib/columns";
import {
  archiveClient,
  archiveProject,
  deleteTask,
  moveTask,
  upsertClient,
  upsertProject,
  upsertTask,
} from "@/lib/mamyda/workspace";
import { deleteClientFile, listClientFiles, uploadClientFile } from "@/lib/mamyda/files";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Client, Project, Task } from "@/lib/mamyda/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/board")({ component: BoardPage });

function priorityTone(p: string) {
  if (p === "urgent") return "danger" as const;
  if (p === "high") return "warn" as const;
  return "muted" as const;
}

function BoardPage() {
  const ws = useWorkspace();
  const [clientId, setClientId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [task, setTask] = useState<Partial<Task> | null>(null);

  const clients = ws.data?.clients ?? [];
  const projects = ws.data?.projects ?? [];
  const tasks = ws.data?.tasks ?? [];

  const selectedClient = clientId
    ? clients.find((c) => c.id === clientId)
    : clients[0];
  const clientProjects = projects.filter(
    (p) => p.clientId === selectedClient?.id,
  );
  const selectedProject = projectId
    ? (clientProjects.find((p) => p.id === projectId) ?? clientProjects[0])
    : clientProjects[0];
  const boardTasks = tasks.filter((t) => t.projectId === selectedProject?.id);

  async function refresh() {
    await ws.refetch();
  }

  return (
    <AppShell
      title="Board"
      action={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingClient(false);
              setClientOpen(true);
            }}
          >
            New client
          </Button>
          {selectedClient && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingClient(true);
                setClientOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit client
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedClient}
            onClick={() => {
              setEditingProject(false);
              setProjectOpen(true);
            }}
          >
            New project
          </Button>
          {selectedProject && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingProject(true);
                setProjectOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit project
            </Button>
          )}
        </div>
      }
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setClientId(c.id);
              setProjectId(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
              selectedClient?.id === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            <span className={cn("size-2 rounded-full", colorDot(c.color))} />
            {c.name}
          </button>
        ))}
      </div>

      {selectedClient && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {clientProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProjectId(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                selectedProject?.id === p.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {p.name}
            </button>
          ))}
          {selectedProject && (
            <span className="text-xs text-muted-foreground">
              #{selectedProject.slug}
            </span>
          )}
        </div>
      )}

      {selectedProject ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0">
          {TASK_COLUMNS.map((col) => {
            const colTasks = boardTasks
              .filter((t) => t.columnId === col.id)
              .sort((a, b) => a.position - b.position);
            return (
              <div
                key={col.id}
                className="w-72 shrink-0 rounded-xl border border-border bg-muted/40 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/task-id");
                  if (!id) return;
                  void moveTask({
                    data: { id, columnId: col.id, position: Date.now() },
                  }).then(refresh);
                }}
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <h3 className="text-sm font-medium">{col.label}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <Card
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/task-id", t.id)
                      }
                      onClick={() => setTask(t)}
                      className="cursor-grab p-3 active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium">{t.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                        {t.dueAt && (
                          <Badge
                            tone={
                              new Date(t.dueAt) < new Date() && t.columnId !== "done"
                                ? "danger"
                                : "muted"
                            }
                          >
                            {formatDay(t.dueAt)}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-card"
                    onClick={() =>
                      setTask({
                        projectId: selectedProject.id,
                        columnId: col.id,
                        priority: "normal",
                        title: "",
                      })
                    }
                  >
                    Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a client, then a project, then the work.
        </p>
      )}

      {selectedClient && <ClientFiles clientId={selectedClient.id} />}

      <ClientDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        client={selectedClient}
        editing={editingClient}
        onSaved={refresh}
      />
      <ProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        client={selectedClient}
        project={selectedProject}
        editing={editingProject}
        onSaved={refresh}
      />
      <TaskDialog task={task} onClose={() => setTask(null)} onSaved={refresh} />
    </AppShell>
  );
}

function ClientDialog({
  open,
  onOpenChange,
  client,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
  editing: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("sage");
  const [creating, setCreating] = useState(true);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCreating(!editing);
    setName(editing ? client?.name ?? "" : "");
    setEmail(editing ? client?.email ?? "" : "");
    setColor(editing ? client?.color ?? "sage" : "sage");
  }, [client, editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{creating ? "New client" : "Edit client"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await upsertClient({
              data: {
                id: creating ? undefined : client?.id,
                name,
                email,
                color,
              },
              headers: captcha ? { "x-turnstile-response": captcha } : undefined,
            });
            setCaptcha("");
            setCaptchaKey((value) => value + 1);
            toast.success(creating ? "Client added" : "Client saved");
            onOpenChange(false);
            onSaved();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cemail">Email</Label>
            <Input
              id="cemail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {CLIENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "size-7 rounded-full",
                  colorDot(c),
                  color === c && "ring-2 ring-ring ring-offset-2",
                )}
                aria-label={c}
              />
            ))}
          </div>
          <TurnstileField action="client-manage" resetKey={captchaKey} onToken={setCaptcha} />
          <div className="flex justify-between pt-2">
            {!creating && client && (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await archiveClient({
                    data: client.id,
                    headers: captcha ? { "x-turnstile-response": captcha } : undefined,
                  });
                  onOpenChange(false);
                  onSaved();
                }}
              >
                Archive
              </Button>
            )}
            <Button type="submit" className="ml-auto">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  client,
  project,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
  project?: Project;
  editing: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(true);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCreating(!editing);
    setName(editing ? project?.name ?? "" : "");
    setDescription(editing ? project?.description ?? "" : "");
  }, [editing, open, project]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{creating ? "New project" : "Edit project"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!client) return;
            await upsertProject({
              data: {
                id: creating ? undefined : project?.id,
                clientId: client.id,
                name,
                description,
              },
              headers: captcha ? { "x-turnstile-response": captcha } : undefined,
            });
            setCaptcha("");
            setCaptchaKey((value) => value + 1);
            toast.success("Project saved");
            onOpenChange(false);
            onSaved();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input
              id="pname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdesc">Description</Label>
            <Textarea
              id="pdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-between pt-2">
            {!creating && project && (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await archiveProject({
                    data: project.id,
                    headers: captcha ? { "x-turnstile-response": captcha } : undefined,
                  });
                  onOpenChange(false);
                  onSaved();
                }}
              >
                Archive
              </Button>
            )}
            <Button type="submit" className="ml-auto">
              Save
            </Button>
          </div>
          <TurnstileField action="project-manage" resetKey={captchaKey} onToken={setCaptcha} />
        </form>
      </DialogContent>
    </Dialog>
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
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const open = Boolean(task);
  const isNew = !task?.id;

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setNotes(task.notes ?? "");
    setPriority(task.priority ?? "normal");
    setDueAt(task.dueAt ? task.dueAt.slice(0, 16) : "");
  }, [task]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{isNew ? "New task" : "Task"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!task?.projectId) return;
            await upsertTask({
              data: {
                id: task.id,
                projectId: task.projectId,
                title,
                notes,
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
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ttitle">Title</Label>
            <Input
              id="ttitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tnotes">Notes</Label>
            <Textarea
              id="tnotes"
              value={notes}
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
          <div className="flex justify-between pt-2">
            {task?.id && (
              <Button
                type="button"
                variant="ghost"
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
            <Button type="submit" className="ml-auto">
              Save
            </Button>
          </div>
          <TurnstileField action="task-manage" resetKey={captchaKey} onToken={setCaptcha} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientFiles({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<Array<{ id: string; name: string; byte_size: number }>>([]);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const rows = await listClientFiles({ data: clientId });
    setFiles(rows);
  }

  useEffect(() => {
    let cancelled = false;
    void listClientFiles({ data: clientId })
      .then((rows) => {
        if (!cancelled) setFiles(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) setNote(error instanceof Error ? error.message : "Could not list files");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <Card className="mb-4 p-4">
      <h2 className="text-sm font-medium">Client files</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Stored in the file bucket, not in the database. Up to 8 MB. PDF, images, text, and Office documents.
      </p>
      <label className="mt-3 inline-flex cursor-pointer text-sm underline-offset-4 hover:underline">
        Upload
        <input
          className="sr-only"
          type="file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
              reader.onerror = () => reject(new Error("Could not read the file"));
              reader.readAsDataURL(file);
            });
            try {
              await uploadClientFile({
                data: { clientId, name: file.name, contentType: file.type || "application/octet-stream", base64 },
              });
              setNote(null);
              await refresh();
            } catch (error) {
              setNote(error instanceof Error ? error.message : "Upload failed");
            }
          }}
        />
      </label>
      {note && <p className="mt-2 text-sm text-destructive">{note}</p>}
      <ul className="mt-3 space-y-1">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
            <a className="truncate underline-offset-4 hover:underline" href={`/api/files/${file.id}`}>
              {file.name}
            </a>
            <button
              type="button"
              className="text-muted-foreground"
              onClick={async () => {
                await deleteClientFile({ data: file.id });
                await refresh();
              }}
            >
              Remove
            </button>
          </li>
        ))}
        {files.length === 0 && <li className="text-sm text-muted-foreground">No files yet.</li>}
      </ul>
    </Card>
  );
}

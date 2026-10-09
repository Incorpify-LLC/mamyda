import { useEffect, useState } from "react";
import { Columns3, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TASK_COLUMNS } from "@/lib/columns";
import {
  groupTasksByStatus,
  resolveTaskView,
  TASK_VIEW_STORAGE_KEY,
  type TaskView,
} from "@/lib/task-view";
import type { Task } from "@/lib/mamyda/types";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ProjectTaskBoard({
  tasks,
  onOpen,
  onCreate,
  onMove,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onCreate: (columnId: string) => void;
  onMove: (id: string, columnId: string) => Promise<void>;
}) {
  // CSS supplies the responsive default before hydration; explicit preference overrides it.
  const [view, setView] = useState<TaskView | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(TASK_VIEW_STORAGE_KEY);
      } catch {
        /* Preferences are optional. */
      }
      setView(resolveTaskView(saved, media.matches));
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  function choose(next: TaskView) {
    setView(next);
    try {
      localStorage.setItem(TASK_VIEW_STORAGE_KEY, next);
    } catch {
      /* Keep the in-session choice. */
    }
  }
  async function move(id: string, columnId: string) {
    if (moving) return;
    setMoving(true);
    setError(null);
    try {
      await onMove(id, columnId);
    } catch {
      setError("Could not move the task. Please try again.");
    } finally {
      setMoving(false);
    }
  }
  return (
    <section aria-label="Project tasks" className="min-w-0" data-task-view={view ?? "responsive"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => onCreate("backlog")}>
          <Plus className="size-4" aria-hidden="true" />
          Add task
        </Button>
        <div role="group" aria-label="Task layout" className="flex gap-1 rounded-md bg-muted p-1">
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-pressed={view === "list"}
            onClick={() => choose("list")}
          >
            <List className="size-4" aria-hidden="true" />
            Grouped list
          </Button>
          <Button
            size="sm"
            variant={view === "kanban" ? "secondary" : "ghost"}
            aria-pressed={view === "kanban"}
            onClick={() => choose("kanban")}
          >
            <Columns3 className="size-4" aria-hidden="true" />
            Kanban
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        className={cn(
          "task-groups",
          view === "list" && "task-groups-list",
          view === "kanban" && "task-groups-kanban",
        )}
      >
        {groupTasksByStatus(tasks).map((column) => (
          <section
            key={column.id}
            aria-label={`${column.label} tasks`}
            className="task-group rounded-lg bg-muted/50 p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/task-id");
              if (id) void move(id, column.id);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {column.label}{" "}
                <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                  {column.tasks.length}
                </span>
              </h2>
              <button
                type="button"
                aria-label={`Add task to ${column.label}`}
                className="flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-primary hover:bg-card"
                onClick={() => onCreate(column.id)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </button>
            </div>
            <div className="space-y-2">
              {column.tasks.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">No tasks yet.</p>
              )}
              {column.tasks.map((task) => (
                <article
                  key={task.id}
                  draggable={!moving}
                  onDragStart={(event) => event.dataTransfer.setData("text/task-id", task.id)}
                  className="task-row min-w-0 rounded-md border border-border bg-card p-3"
                >
                  <button
                    type="button"
                    aria-label={`Open task ${task.title}`}
                    className="min-w-0 flex-1 rounded-sm text-left"
                    onClick={() => onOpen(task)}
                  >
                    <span className="block break-words text-sm font-medium [overflow-wrap:anywhere]">
                      {task.title}
                    </span>
                    {task.encrypted && (
                      <span className="block text-xs text-muted-foreground">
                        🔒 Content encrypted
                      </span>
                    )}
                    <span className="mt-2 flex flex-wrap gap-1">
                      <Badge
                        tone={
                          task.priority === "urgent"
                            ? "danger"
                            : task.priority === "high"
                              ? "warn"
                              : "muted"
                        }
                      >
                        {task.priority}
                      </Badge>
                      {task.dueAt && (
                        <Badge
                          tone={
                            new Date(task.dueAt) < new Date() && task.columnId !== "done"
                              ? "danger"
                              : "muted"
                          }
                        >
                          {formatDay(task.dueAt)}
                        </Badge>
                      )}
                    </span>
                  </button>
                  <label className="task-status block text-xs text-muted-foreground">
                    Move to
                    <select
                      disabled={moving}
                      aria-label={`Move ${task.title} to status`}
                      value={task.columnId}
                      className="mt-1 h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      onChange={(event) => void move(task.id, event.target.value)}
                    >
                      {TASK_COLUMNS.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

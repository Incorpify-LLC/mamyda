import { TASK_COLUMNS } from "@/lib/columns";
import type { Task } from "@/lib/mamyda/types";

export type TaskView = "list" | "kanban";
export const TASK_VIEW_STORAGE_KEY = "mamyda-task-view";

export function resolveTaskView(saved: string | null, mobile: boolean): TaskView {
  return saved === "list" || saved === "kanban" ? saved : mobile ? "list" : "kanban";
}

export function groupTasksByStatus(tasks: Task[]) {
  return TASK_COLUMNS.map((column) => ({
    ...column,
    tasks: tasks
      .filter((task) => task.columnId === column.id)
      .sort((a, b) => a.position - b.position),
  }));
}

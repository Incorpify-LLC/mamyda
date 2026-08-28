export const TASK_COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "this_week", label: "This week" },
  { id: "doing", label: "Doing" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
] as const;

export type TaskColumnId = (typeof TASK_COLUMNS)[number]["id"];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CLIENT_COLORS = [
  "sage",
  "ink",
  "clay",
  "slate",
  "olive",
] as const;
export type ClientColor = (typeof CLIENT_COLORS)[number];

export function isColumnId(value: string): value is TaskColumnId {
  return TASK_COLUMNS.some((c) => c.id === value);
}

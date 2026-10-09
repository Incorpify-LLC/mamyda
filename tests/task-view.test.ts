import { describe, expect, it } from "vitest";
import { resolveTaskView, groupTasksByStatus } from "@/lib/task-view";
import type { Task } from "@/lib/mamyda/types";

describe("task view preference", () => {
  it("defaults to grouped list on mobile and Kanban on desktop", () => {
    expect(resolveTaskView(null, true)).toBe("list");
    expect(resolveTaskView(null, false)).toBe("kanban");
  });
  it("honors explicit choices and ignores invalid stored values", () => {
    expect(resolveTaskView("kanban", true)).toBe("kanban");
    expect(resolveTaskView("list", false)).toBe("list");
    expect(resolveTaskView("corrupt", true)).toBe("list");
  });
  it("keeps status ordering, empty groups and task position without mutating input", () => {
    const tasks = [
      { id: "later", columnId: "doing", position: 2 },
      { id: "first", columnId: "doing", position: 1 },
    ] as Task[];
    const groups = groupTasksByStatus(tasks);
    expect(groups.map((group) => group.id)).toEqual([
      "backlog",
      "this_week",
      "doing",
      "waiting",
      "done",
    ]);
    expect(groups[0].tasks).toEqual([]);
    expect(groups[2].tasks.map((task) => task.id)).toEqual(["first", "later"]);
    expect(tasks[0].id).toBe("later");
  });
});

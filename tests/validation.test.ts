import { expect, test } from "vitest";
import { taskInput, noteInput, moveInput, profileInput } from "@/lib/mamyda/validation";
test("task input rejects malformed dates, columns, priorities and oversized payloads", () => {
  for (const extra of [
    { dueAt: "yesterday" },
    { columnId: "lost" },
    { priority: "critical" },
    { title: "x".repeat(501) },
    { labels: Array(51).fill("x") },
  ]) {
    expect(taskInput.safeParse({ projectId: "p", title: "Task", ...extra }).success).toBe(false);
  }
});
test("validators reject malformed transport payloads", () => {
  expect(noteInput.safeParse(null).success).toBe(false);
  expect(noteInput.safeParse({ body: 42 }).success).toBe(false);
  expect(moveInput.safeParse({ id: "t", columnId: "done", position: Infinity }).success).toBe(
    false,
  );
  expect(profileInput.safeParse({ alertEmail: "invalid" }).success).toBe(false);
});
test("valid clearing and partial updates are retained", () => {
  expect(profileInput.parse({ alertEmail: null, alertsDueSoon: false })).toEqual({
    alertEmail: null,
    alertsDueSoon: false,
  });
  expect(
    taskInput.parse({ projectId: "p", title: "Task", dueAt: "2026-09-10T18:00:00+05:30" }).dueAt,
  ).toContain("+05:30");
});

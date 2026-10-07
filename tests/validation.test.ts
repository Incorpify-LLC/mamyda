import { expect, test } from "vitest";
import {
  taskInput,
  noteInput,
  moveInput,
  profileInput,
  calendarEventWriteInput,
} from "@/lib/mamyda/validation";
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
test("calendar event writes reject missing titles and unbounded text fields", () => {
  const event = {
    sourceId: "source",
    title: "Planning",
    description: "",
    location: "",
    startsAt: "2026-10-07T09:00:00.000Z",
    endsAt: "2026-10-07T10:00:00.000Z",
    allDay: false,
  };
  expect(calendarEventWriteInput.safeParse(event).success).toBe(true);
  expect(calendarEventWriteInput.safeParse({ ...event, title: " " }).success).toBe(false);
  expect(
    calendarEventWriteInput.safeParse({ ...event, description: "x".repeat(8001) }).success,
  ).toBe(false);
  expect(calendarEventWriteInput.safeParse({ ...event, allDay: "yes" }).success).toBe(false);
});

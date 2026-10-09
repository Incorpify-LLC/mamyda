import { expect, test } from "vitest";
import { BOARD_SECTIONS, isBoardPath, boardSearchContext } from "@/lib/board-navigation";
test("Board groups Tasks, Minutes, Notes and Vault while retaining legacy URLs", () => {
  expect(BOARD_SECTIONS.map((section) => section.label)).toEqual([
    "Tasks",
    "Minutes",
    "Notes",
    "Files",
    "Vault",
  ]);
  for (const path of ["/board", "/minutes", "/notes", "/vault"])
    expect(isBoardPath(path)).toBe(true);
  for (const path of ["/calendar", "/settings", "/boardwalk", "/"])
    expect(isBoardPath(path)).toBe(false);
});
test("section switches preserve client/project context without stale record selections", () => {
  expect(
    boardSearchContext({
      clientId: "client",
      projectId: "project",
      noteId: "note",
      taskId: "task",
    }),
  ).toEqual({ clientId: "client", projectId: "project" });
  expect(boardSearchContext({ clientId: 123, projectId: "" })).toEqual({});
});

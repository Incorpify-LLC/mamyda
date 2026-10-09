import { expect, test } from "vitest";
import { resolveProjectContext } from "@/lib/project-context";

const clients = [
  { id: "a", name: "Alpha", archived: false },
  { id: "b", name: "Beta", archived: false },
  { id: "old", name: "Old", archived: true },
];
const projects = [
  { id: "p", clientId: "a", name: "One", archived: false },
  { id: "q", clientId: "b", name: "Two", archived: false },
  { id: "x", clientId: "a", name: "Archived", archived: true },
];
test("project-only direct links resolve their owning client", () => {
  expect(resolveProjectContext(clients, projects, { projectId: "q" }).search).toEqual({
    clientId: "b",
    projectId: "q",
  });
});
test("explicit mismatched client/project does not select unrelated assets", () => {
  expect(resolveProjectContext(clients, projects, { clientId: "a", projectId: "q" }).invalid).toBe(
    true,
  );
});
test("missing and archived selections require explicit recovery", () => {
  for (const search of [{ projectId: "missing" }, { projectId: "x" }, { clientId: "old" }]) {
    const result = resolveProjectContext(clients, projects, search);
    expect(result.invalid).toBe(true);
    expect(result.project).toBeUndefined();
  }
});
test("default selection is resolved and portable, while all-project scope stays explicit", () => {
  expect(resolveProjectContext(clients, projects, {}, true).search).toEqual({
    clientId: "a",
    projectId: "p",
  });
  expect(resolveProjectContext(clients, projects, {}).search).toEqual({});
  expect(resolveProjectContext(clients, projects, { clientId: "b" }).search).toEqual({
    clientId: "b",
  });
});
test("empty workspaces do not invent a selection", () => {
  expect(resolveProjectContext([], [], {}, true).search).toEqual({});
});

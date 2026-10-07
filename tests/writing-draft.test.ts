import { expect, test, vi } from "vitest";
import { clearWritingDrafts, writingDraftKey } from "@/lib/writing-draft-storage";

test("draft keys are scoped to accounts and editors", () => {
  expect(writingDraftKey("alice", "notes")).not.toBe(writingDraftKey("bob", "notes"));
  expect(writingDraftKey("alice", "notes")).not.toBe(writingDraftKey("alice", "minutes"));
  expect(writingDraftKey("a/b", "notes")).toContain("a%2Fb");
});
test("sign-out clears all writing drafts without touching theme or vault metadata", () => {
  const storage = () => {
    const values = new Map([
      [writingDraftKey("alice", "notes"), "private draft"],
      [writingDraftKey("bob", "minutes"), "another"],
      ["mamyda-theme", "dark"],
      ["vault-metadata", "encrypted"],
    ]);
    return {
      values,
      get length() {
        return values.size;
      },
      key: (i: number) => [...values.keys()][i],
      removeItem: (key: string) => values.delete(key),
    };
  };
  const sessionStorage = storage(),
    localStorage = storage();
  vi.stubGlobal("window", { sessionStorage, localStorage });
  try {
    clearWritingDrafts();
    expect([...sessionStorage.values.keys()]).toEqual(["mamyda-theme", "vault-metadata"]);
    expect([...localStorage.values.keys()]).toEqual(["mamyda-theme", "vault-metadata"]);
  } finally {
    vi.unstubAllGlobals();
  }
});
test("restricted browser storage cannot prevent sign-out", () => {
  vi.stubGlobal("window", {
    get sessionStorage() {
      throw new Error("Blocked");
    },
    get localStorage() {
      throw new Error("Blocked");
    },
  });
  try {
    expect(() => clearWritingDrafts()).not.toThrow();
  } finally {
    vi.unstubAllGlobals();
  }
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/personal-preferences";
import { groupNotesByProject, resolveDefaultNoteProjectId } from "@/lib/notes-grouping";
import {
  applyMarkdownToolbarAction,
  applyMarkdownKeyCommand,
  normalizeTabIndent,
} from "@/lib/markdown-editor";
import { Textarea } from "@/components/ui/textarea";
import type { Note, Project } from "@/lib/mamyda/types";

describe("1. Collapsible left navigation bar", () => {
  it("reads and persists sidebar collapsed state with a false default", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    expect(readSidebarCollapsed(storage)).toBe(false);
    writeSidebarCollapsed(storage, true);
    expect(readSidebarCollapsed(storage)).toBe(true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });

  it("handles unavailable storage gracefully", () => {
    const broken = {
      getItem: () => {
        throw new Error("Blocked");
      },
      setItem: () => {
        throw new Error("Blocked");
      },
    };
    expect(readSidebarCollapsed(broken)).toBe(false);
    expect(() => writeSidebarCollapsed(broken, true)).not.toThrow();
  });
});

describe("2. Notes folding under projects with 'saneax' default project", () => {
  const makeProject = (overrides: Partial<Project> & { id: string; name: string }): Project => ({
    clientId: "c1",
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    description: "",
    archived: false,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  });

  const makeNote = (overrides: Partial<Note> & { id: string; title: string }): Note => ({
    projectId: null,
    body: "Note body",
    tags: [],
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
    ...overrides,
  });

  it("folds notes without a project under the default 'saneax' project section", () => {
    const projects: Project[] = [
      makeProject({ id: "p-alpha", name: "Alpha" }),
      makeProject({ id: "p-beta", name: "Beta" }),
    ];
    const notes: Note[] = [
      makeNote({ id: "n1", title: "Alpha spec", projectId: "p-alpha" }),
      makeNote({ id: "n2", title: "Quick thought", projectId: null }),
      makeNote({ id: "n3", title: "Another unlinked note", projectId: null }),
    ];

    const groups = groupNotesByProject(notes, projects);
    expect(groups.map((g) => g.projectName)).toEqual(["saneax", "Alpha"]);
    expect(groups[0].notes.map((n) => n.id)).toEqual(["n2", "n3"]);
    expect(groups[0].isDefaultSaneax).toBe(true);
    expect(groups[1].notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("merges unlinked notes into an existing 'saneax' project when present in workspace", () => {
    const projects: Project[] = [
      makeProject({ id: "p-saneax", name: "saneax", slug: "saneax" }),
      makeProject({ id: "p-alpha", name: "Alpha" }),
    ];
    const notes: Note[] = [
      makeNote({ id: "n1", title: "Explicit saneax note", projectId: "p-saneax" }),
      makeNote({ id: "n2", title: "Unassigned note", projectId: null }),
      makeNote({ id: "n3", title: "Alpha note", projectId: "p-alpha" }),
    ];

    const groups = groupNotesByProject(notes, projects);
    expect(groups).toHaveLength(2);
    expect(groups[0].projectId).toBe("p-saneax");
    expect(groups[0].projectName).toBe("saneax");
    expect(groups[0].notes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(groups[1].projectId).toBe("p-alpha");
    expect(groups[1].notes.map((n) => n.id)).toEqual(["n3"]);
  });

  it("resolves default project ID to saneax project when no context project is chosen", () => {
    const projects: Project[] = [
      makeProject({ id: "p-alpha", name: "Alpha" }),
      makeProject({ id: "p-saneax", name: "Saneax", slug: "saneax" }),
    ];
    expect(resolveDefaultNoteProjectId(projects, null)).toBe("p-saneax");
    expect(resolveDefaultNoteProjectId(projects, "p-alpha")).toBe("p-alpha");
    expect(
      resolveDefaultNoteProjectId([makeProject({ id: "p-alpha", name: "Alpha" })], null),
    ).toBeNull();
  });
});

describe("3. Markdown toolbar, 2-space tab/list formatting, and monospace notes", () => {
  it("applies markdown toolbar formatting intuitively to selections and cursor", () => {
    const bold = applyMarkdownToolbarAction("hello world", 6, 11, "bold");
    expect(bold.value).toBe("hello **world**");
    expect(bold.selectionStart).toBe(8);
    expect(bold.selectionEnd).toBe(13);

    const italic = applyMarkdownToolbarAction("hello world", 0, 5, "italic");
    expect(italic.value).toBe("*hello* world");

    const heading = applyMarkdownToolbarAction("Title line\nBody", 2, 2, "heading");
    expect(heading.value).toBe("# Title line\nBody");

    const bullet = applyMarkdownToolbarAction("First\nSecond", 0, 12, "bullet-list");
    expect(bullet.value).toBe("- First\n- Second");

    const numbered = applyMarkdownToolbarAction("First\nSecond", 0, 12, "numbered-list");
    expect(numbered.value).toBe("1. First\n2. Second");

    const checklist = applyMarkdownToolbarAction("Task one\nTask two", 0, 17, "checklist");
    expect(checklist.value).toBe("- [ ] Task one\n- [ ] Task two");

    const link = applyMarkdownToolbarAction("Read docs", 5, 9, "link");
    expect(link.value).toBe("Read [docs](https://)");

    const codeBlock = applyMarkdownToolbarAction("const x = 1;\nconst y = 2;", 0, 25, "code");
    expect(codeBlock.value).toBe("```\nconst x = 1;\nconst y = 2;\n```");

    const inlineCode = applyMarkdownToolbarAction("run npm test now", 4, 12, "code");
    expect(inlineCode.value).toBe("run `npm test` now");

    const quote = applyMarkdownToolbarAction("Quoted line", 0, 11, "quote");
    expect(quote.value).toBe("> Quoted line");

    const urlLink = applyMarkdownToolbarAction("https://mamyda.incorpify.in", 0, 27, "link");
    expect(urlLink.value).toBe("[link](https://mamyda.incorpify.in)");
  });

  it("indents and outdents list items and lines by 2 spaces on Tab and Shift+Tab", () => {
    const text = "- parent\n- child";
    // Cursor inside "- child" (index 11)
    const indented = applyMarkdownKeyCommand(text, 11, 11, "Tab", false);
    expect(indented).not.toBeNull();
    expect(indented!.value).toBe("- parent\n  - child");
    expect(indented!.selectionStart).toBe(13);

    // Shift+Tab outdents by 2 spaces
    const outdented = applyMarkdownKeyCommand(
      indented!.value,
      indented!.selectionStart,
      indented!.selectionEnd,
      "Tab",
      true,
    );
    expect(outdented).not.toBeNull();
    expect(outdented!.value).toBe("- parent\n- child");
    expect(outdented!.selectionStart).toBe(11);
  });

  it("inserts 2 spaces on Tab when on a plain non-list line without selection", () => {
    const res = applyMarkdownKeyCommand("plain", 5, 5, "Tab", false);
    expect(res).not.toBeNull();
    expect(res!.value).toBe("plain  ");
    expect(res!.selectionStart).toBe(7);
  });

  it("auto-continues bullet, numbered, and checklist items on Enter preserving 2-space indentation", () => {
    const bulletCont = applyMarkdownKeyCommand("  - nested item", 15, 15, "Enter", false);
    expect(bulletCont).not.toBeNull();
    expect(bulletCont!.value).toBe("  - nested item\n  - ");

    const numberedCont = applyMarkdownKeyCommand("  1. first step", 15, 15, "Enter", false);
    expect(numberedCont).not.toBeNull();
    expect(numberedCont!.value).toBe("  1. first step\n  2. ");

    const checkCont = applyMarkdownKeyCommand("- [x] done task", 15, 15, "Enter", false);
    expect(checkCont).not.toBeNull();
    expect(checkCont!.value).toBe("- [x] done task\n- [ ] ");
  });

  it("outdents or exits an empty list item when pressing Enter", () => {
    // Nested empty list item outdents by 2 spaces first
    const nestedEmpty = applyMarkdownKeyCommand("- parent\n  - ", 13, 13, "Enter", false);
    expect(nestedEmpty).not.toBeNull();
    expect(nestedEmpty!.value).toBe("- parent\n- ");

    // Top-level empty list item exits the list cleanly
    const rootEmpty = applyMarkdownKeyCommand("- parent\n- ", 11, 11, "Enter", false);
    expect(rootEmpty).not.toBeNull();
    expect(rootEmpty!.value).toBe("- parent\n");
  });

  it("normalizes tab characters to 2 spaces", () => {
    expect(normalizeTabIndent("\t- item\n\t\t- subitem")).toBe("  - item\n    - subitem");
  });

  it("renders markdown toolbar buttons when markdownToolbar is enabled on Textarea", () => {
    const html = renderToStaticMarkup(
      <Textarea
        markdownToolbar
        className="font-mono"
        aria-label="Note body"
        value="# Hello"
        onChange={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Markdown formatting"');
    expect(html).toContain('aria-label="Bold"');
    expect(html).toContain('aria-label="Italic"');
    expect(html).toContain('aria-label="Heading"');
    expect(html).toContain('aria-label="Bullet list"');
    expect(html).toContain('aria-label="Numbered list"');
    expect(html).toContain('aria-label="Checklist"');
    expect(html).toContain('aria-label="Link"');
    expect(html).toContain('aria-label="Code"');
    expect(html).toContain("font-mono");
  });
});

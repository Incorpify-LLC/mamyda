import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownView } from "../src/components/markdown-view";
import { editorDraftKey, draftTitle, readEditorDraft } from "../src/lib/editor-drafts";

describe("Markdown and local drafts", () => {
  it("renders headings, lists, links and GFM tables", () => {
    const html = renderToStaticMarkup(
      <MarkdownView>
        {"# Heading\n\n- Item\n\n[Docs](https://example.com)\n\n| A | B |\n| - | - |\n| 1 | 2 |"}
      </MarkdownView>,
    );
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<li>Item</li>");
    expect(html).toContain("<table>");
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("does not execute HTML, unsafe links or fetch images", () => {
    const html = renderToStaticMarkup(
      <MarkdownView>
        {
          "<script>alert(1)</script>\n\n[x](javascript:alert%281%29)\n\n![private](https://tracker.example/pixel)"
        }
      </MarkdownView>,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("tracker.example");
  });
  it("isolates records, projects and accounts", () => {
    const keys = [
      editorDraftKey("a", "p", "n"),
      editorDraftKey("b", "p", "n"),
      editorDraftKey("a", "q", "n"),
      editorDraftKey("a", "p", "m"),
    ];
    expect(new Set(keys).size).toBe(4);
  });
  it("names untitled drafts without leaking encrypted opening sentences", () => {
    expect(draftTitle("Opening sentence. More text")).toBe("Opening sentence");
    expect(draftTitle("Secret opening", "", true)).toBe("Encrypted draft");
    expect(draftTitle("Secret opening", "Visible name", true)).toBe("Visible name");
  });
  it("rejects empty, expired or malformed drafts", () => {
    const entry = {
      version: 1,
      title: "Draft",
      body: "text",
      encrypted: false,
      updatedAt: Date.now(),
    };
    expect(readEditorDraft(JSON.stringify(entry))).toEqual(entry);
    for (const changed of [{ body: " \n" }, { version: 2 }, { encrypted: "yes" }, { updatedAt: 1 }])
      expect(readEditorDraft(JSON.stringify({ ...entry, ...changed }))).toBeNull();
    expect(readEditorDraft("broken")).toBeNull();
  });
});

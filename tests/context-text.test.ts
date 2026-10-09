import { test, expect } from "vitest";
import {
  extractContextText,
  docxText,
  supportedContextFile,
} from "@/lib/mamyda/context-text.server";
test("context formats, UTF-8, output bounds and document entities are validated", async () => {
  expect(supportedContextFile("recording.mp4", 100)).toBe(false);
  expect(supportedContextFile("meeting.pdf", 24 * 1024 * 1024)).toBe(true);
  expect(supportedContextFile("meeting.pdf", 24 * 1024 * 1024 + 1)).toBe(false);
  expect(await extractContextText("notes.md", new TextEncoder().encode("Useful context"))).toBe(
    "Useful context",
  );
  await expect(extractContextText("x.txt", new Uint8Array([0xff]))).rejects.toThrow("UTF-8");
  await expect(
    extractContextText("x.txt", new TextEncoder().encode("x".repeat(20001))),
  ).rejects.toThrow("20,000");
  expect(
    docxText(
      "<w:p><w:r><w:t>Client &amp; team</w:t></w:r></w:p><w:p><w:r><w:t>Next step</w:t></w:r></w:p>",
    ),
  ).toBe("Client & team\nNext step");
  expect(() => docxText('<!DOCTYPE xml [<!ENTITY x SYSTEM "file:///private">]>')).toThrow(
    "entities",
  );
  await expect(extractContextText("x.pdf", new TextEncoder().encode("not a PDF"))).rejects.toThrow(
    "Could not extract",
  );
});

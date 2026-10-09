import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export function supportedContextFile(name: string, size: number) {
  return /\.(pdf|docx)$/i.test(name)
    ? size <= 24 * 1024 * 1024
    : /\.(txt|md|csv|json|log|ics|xml|html|yaml|yml)$/i.test(name) && size <= 2 * 1024 * 1024;
}
function unescapeXml(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_all, entity: string) => {
    const named: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
    if (named[entity]) return named[entity];
    const code = entity.toLowerCase().startsWith("#x")
      ? parseInt(entity.slice(2), 16)
      : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}
export function docxText(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsupported document entities");
  return xml
    .split(/<\/w:p>/)
    .map((paragraph) =>
      [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((match) => unescapeXml(match[1]))
        .join(""),
    )
    .filter(Boolean)
    .join("\n");
}
export async function extractContextText(name: string, bytes: Uint8Array) {
  if (!supportedContextFile(name, bytes.byteLength))
    throw new Error("Context supports PDF/DOCX up to 24 MiB or UTF-8 text files up to 2 MiB");
  let text: string;
  if (/\.(pdf|docx)$/i.test(name)) {
    const directory = await mkdtemp(join(tmpdir(), "mamyda-context-"));
    const file = join(directory, /\.pdf$/i.test(name) ? "document.pdf" : "document.docx");
    try {
      await writeFile(file, bytes, { mode: 0o600 });
      if (/\.pdf$/i.test(name)) {
        if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new Error();
        text = (
          await run("pdftotext", ["-enc", "UTF-8", "-nopgbrk", file, "-"], {
            timeout: 15000,
            maxBuffer: 1000000,
          })
        ).stdout;
      } else {
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error();
        text = docxText(
          (
            await run("unzip", ["-p", file, "word/document.xml"], {
              timeout: 15000,
              maxBuffer: 1000000,
            })
          ).stdout,
        );
      }
    } catch {
      throw new Error(
        "Could not extract document text. Scanned/password-protected PDFs need a readable text export; very large documents need a shorter excerpt.",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("File context must be UTF-8 text");
    }
  }
  if (text.includes("\u0000") || !text.trim()) throw new Error("No usable text context found");
  if (text.length > 20000)
    throw new Error("File context exceeds 20,000 characters; upload a shorter excerpt");
  return text.trim();
}

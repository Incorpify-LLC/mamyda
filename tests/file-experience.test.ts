import { expect, test } from "vitest";
import {
  fileExtension,
  sortFiles,
  validateFileSelection,
  MAX_FILE_BYTES,
} from "@/lib/file-experience";
test("multi-file validation allows 24 MiB per file and rejects empty, oversized and excessive batches", () => {
  expect(() => validateFileSelection([{ name: "a.pdf", size: 24 * 1024 * 1024 }])).not.toThrow();
  expect(MAX_FILE_BYTES).toBe(24 * 1024 * 1024);
  expect(() => validateFileSelection([{ name: "empty", size: 0 }])).toThrow();
  expect(() => validateFileSelection([{ name: "big", size: MAX_FILE_BYTES + 1 }])).toThrow();
  expect(() =>
    validateFileSelection(Array.from({ length: 21 }, () => ({ name: "x", size: 1 }))),
  ).toThrow();
});
test("extension and stable sorts cover name, type, size and uploaded date without mutating rows", () => {
  const rows = [
    { id: "a", name: "z.PDF", byte_size: 20, created_at: "2026-01-01" },
    { id: "b", name: "a.txt", byte_size: 10, created_at: "2026-02-01" },
  ];
  expect(fileExtension("z.PDF")).toBe("pdf");
  expect(fileExtension("README")).toBe("—");
  expect(sortFiles(rows, "name", "asc")[0].id).toBe("b");
  expect(sortFiles(rows, "extension", "asc")[0].id).toBe("a");
  expect(sortFiles(rows, "size", "asc")[0].id).toBe("b");
  expect(sortFiles(rows, "date", "desc")[0].id).toBe("b");
  expect(rows[0].id).toBe("a");
});

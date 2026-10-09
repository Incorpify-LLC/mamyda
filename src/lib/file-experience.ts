export const MAX_FILE_BYTES = 24 * 1024 * 1024;
export const MAX_BATCH_FILES = 20;
export function validateFileSelection(files: Array<{ name: string; size: number }>): void {
  if (!files.length || files.length > MAX_BATCH_FILES)
    throw new Error("Select between 1 and 20 files");
  for (const file of files)
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES)
      throw new Error(`${file.name}: choose a file between 1 byte and 24 MiB`);
}
export function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 && index < name.length - 1 ? name.slice(index + 1).toLowerCase() : "—";
}
export type FileSort = "name" | "extension" | "size" | "date";
export function sortFiles<
  T extends { id: string; name: string; byte_size: number; created_at: string },
>(rows: T[], sort: FileSort, direction: "asc" | "desc"): T[] {
  return [...rows].sort((a, b) => {
    const result =
      sort === "size"
        ? a.byte_size - b.byte_size
        : sort === "date"
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : (sort === "extension" ? fileExtension(a.name) : a.name).localeCompare(
              sort === "extension" ? fileExtension(b.name) : b.name,
              undefined,
              { numeric: true, sensitivity: "base" },
            );
    return (direction === "asc" ? 1 : -1) * result || a.id.localeCompare(b.id);
  });
}

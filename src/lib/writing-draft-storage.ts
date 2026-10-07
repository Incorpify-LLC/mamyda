const prefix = "mamyda.writing-draft.";
export function writingDraftKey(userId: string, kind: "notes" | "minutes") {
  return `${prefix}${encodeURIComponent(userId)}.${kind}`;
}
export function clearWritingDrafts() {
  if (typeof window === "undefined") return;
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[name];
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) storage.removeItem(key);
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }
}

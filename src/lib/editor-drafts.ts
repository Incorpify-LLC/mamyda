export const EDITOR_DRAFT_PREFIX = "mamyda.editor-draft.";
/** Clear only after a successful explicit save/send. */
export function finishEditorDraft(id: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("mamyda:draft-saved", { detail: id }));
}
export type EditorDraft = {
  version: 1;
  title: string;
  body: string;
  encrypted: boolean;
  updatedAt: number;
};
export function editorDraftKey(user: string, scope: string, field: string) {
  return EDITOR_DRAFT_PREFIX + [user, scope, field].map(encodeURIComponent).join(".");
}
export function draftTitle(body: string, title?: string, encrypted = false) {
  return (
    title?.trim().slice(0, 100) ||
    (encrypted
      ? "Encrypted draft"
      : body
          .trim()
          .split(/[\n.!?]/)[0]
          .slice(0, 80)) ||
    "Untitled draft"
  );
}
export function readEditorDraft(raw: string | null): EditorDraft | null {
  try {
    const entry = JSON.parse(raw || "null");
    if (
      entry?.version !== 1 ||
      typeof entry.title !== "string" ||
      typeof entry.body !== "string" ||
      !entry.body.trim() ||
      typeof entry.encrypted !== "boolean" ||
      !Number.isFinite(entry.updatedAt) ||
      entry.body.length > 400000 ||
      entry.updatedAt < Date.now() - 30 * 86400000
    )
      return null;
    return entry;
  } catch {
    return null;
  }
}

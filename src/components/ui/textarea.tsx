import {
  type TextareaHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { MarkdownView } from "@/components/markdown-view";
import { useEditorDraftContext } from "@/components/editor-draft-context";
import { draftTitle, editorDraftKey, readEditorDraft, type EditorDraft } from "@/lib/editor-drafts";
import { encryptNote, decryptNote, unlockPrivateKey } from "@/lib/vault-crypto";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    draftId?: string;
    draftName?: string;
    sensitive?: boolean;
    encryptedDraftOnly?: boolean;
    onRestoreDraft?: (body: string, encrypted: boolean) => void;
  }
>(function Textarea(
  {
    className,
    draftId,
    draftName,
    sensitive = false,
    encryptedDraftOnly = false,
    onRestoreDraft,
    onChange,
    ...props
  },
  ref,
) {
  const context = useEditorDraftContext();
  const key =
    context.userId && draftId ? editorDraftKey(context.userId, context.scope, draftId) : null;
  const [preview, setPreview] = useState(false);
  const [recovery, setRecovery] = useState<EditorDraft | null>(null);
  const [status, setStatus] = useState("");
  const [password, setPassword] = useState("");
  const [restoring, setRestoring] = useState(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const lastValue = useRef({ key, value: props.value, sensitive });
  const userEdited = useRef(false);
  const previousName = useRef({ key, name: draftName });
  const pendingEncryption = useRef(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingEncryption.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    alive.current = true;
    setRecovery(null);
    setStatus("");
    setPassword("");
    setPreview(false);
    userEdited.current = false;
    try {
      if (key) {
        const raw = localStorage.getItem(key);
        const draft = readEditorDraft(raw);
        setRecovery(draft);
        if (raw && !draft) localStorage.removeItem(key);
      }
    } catch {
      setStatus("Draft storage unavailable. Save before leaving");
    }
    return () => {
      alive.current = false;
      generation.current++;
      pendingEncryption.current = false;
    };
  }, [key]);
  useEffect(() => {
    const finish = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== draftId || !key) return;
      generation.current++;
      pendingEncryption.current = false;
      try {
        localStorage.removeItem(key);
      } catch {}
      setRecovery(null);
      setStatus("");
    };
    window.addEventListener("mamyda:draft-saved", finish);
    return () => window.removeEventListener("mamyda:draft-saved", finish);
  }, [key, draftId]);
  useEffect(() => {
    if (props.disabled) {
      setPreview(false);
      setPassword("");
    }
  }, [props.disabled]);
  const autosave = useCallback(
    async (body: string, preserveRecovery = false) => {
      if (!key || (encryptedDraftOnly && !sensitive)) return;
      const revision = ++generation.current;
      try {
        if (!body.trim()) {
          localStorage.removeItem(key);
          setStatus("");
          setRecovery(null);
          return;
        }
        if (sensitive && !readEditorDraft(localStorage.getItem(key))?.encrypted)
          localStorage.removeItem(key);
        setStatus("Saving draft…");
        if (sensitive && !context.publicKey)
          throw new Error("Create a vault key before saving encrypted drafts");
        pendingEncryption.current = sensitive;
        const stored = sensitive ? await encryptNote(body, context.publicKey!) : body;
        if (stored.length > 400000)
          throw new Error("Text exceeds local draft storage limits. Save before leaving");
        if (!alive.current || revision !== generation.current) return;
        const saved: EditorDraft = {
          version: 1,
          title: draftTitle(body, draftName, sensitive),
          body: stored,
          encrypted: sensitive,
          updatedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(saved));
        setRecovery(preserveRecovery ? saved : null);
        setStatus(
          sensitive ? "Encrypted draft saved on this device" : "Draft saved on this device",
        );
      } catch (error) {
        if (alive.current && revision === generation.current)
          setStatus(
            error instanceof Error ? error.message : "Could not save draft. Save before leaving",
          );
      } finally {
        if (revision === generation.current) pendingEncryption.current = false;
      }
    },
    [key, encryptedDraftOnly, sensitive, context.publicKey, draftName],
  );
  useEffect(() => {
    const previous = lastValue.current;
    lastValue.current = { key, value: props.value, sensitive };
    if (previous.key !== key) {
      if (
        !previous.key &&
        key &&
        sensitive &&
        typeof props.value === "string" &&
        props.value.trim()
      )
        void autosave(props.value);
      return;
    }
    if (previous.value !== props.value || previous.sensitive !== sensitive) {
      if (recovery && !userEdited.current) {
        if (sensitive && !recovery.encrypted) void autosave(recovery.body, true);
        return;
      }
      if (typeof props.value === "string") void autosave(props.value);
    }
  }, [key, props.value, sensitive, autosave, recovery]);
  useEffect(() => {
    const previous = previousName.current;
    previousName.current = { key, name: draftName };
    if (!key || previous.key !== key || previous.name === draftName) return;
    try {
      const draft = readEditorDraft(localStorage.getItem(key));
      if (!draft) return;
      // Renaming must not re-encrypt text, nor expose an encrypted opening sentence.
      const renamed = {
        ...draft,
        title: draftTitle(draft.encrypted ? "" : draft.body, draftName, draft.encrypted),
      };
      localStorage.setItem(key, JSON.stringify(renamed));
      setRecovery((current) => (current ? renamed : null));
    } catch {
      setStatus("Could not update draft name. Save before leaving");
    }
  }, [key, draftName]);
  async function restore() {
    if (!recovery || !onRestoreDraft || restoring) return;
    const revision = ++generation.current;
    setRestoring(true);
    try {
      const body = recovery.encrypted
        ? await decryptNote(
            recovery.body,
            await unlockPrivateKey(context.privateKey || "", password),
          )
        : recovery.body;
      if (!alive.current || revision !== generation.current) return;
      if (props.maxLength && body.length > props.maxLength) throw new Error("Length limit");
      userEdited.current = true;
      onRestoreDraft(body, recovery.encrypted);
      setRecovery(null);
      setPassword("");
      setStatus("Draft restored. Save when ready");
    } catch {
      if (alive.current) setStatus("Could not restore draft. Check your passphrase and vault key");
    } finally {
      if (alive.current) setRestoring(false);
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div role="group" aria-label="Content view" className="flex gap-1">
          {([false, true] as const).map((mode) => (
            <button
              key={String(mode)}
              type="button"
              aria-pressed={preview === mode}
              disabled={props.disabled}
              onClick={() => setPreview(mode)}
              className={cn(
                "rounded px-2 py-1 hover:bg-muted",
                preview === mode && "bg-muted font-medium text-foreground",
              )}
            >
              {mode ? "Preview" : "Edit"}
            </button>
          ))}
        </div>
        <span>Markdown supported</span>
      </div>
      {recovery && onRestoreDraft && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="mb-2">
            Recover draft: {recovery.title}
            {recovery.encrypted ? " · encrypted" : ""}
          </p>
          {recovery.encrypted && (
            <input
              type="password"
              aria-label="Draft passphrase"
              value={password}
              autoComplete="off"
              className="mb-2 w-full rounded border bg-background p-2"
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <button
            type="button"
            disabled={props.disabled || restoring || (recovery.encrypted && !password)}
            onClick={() => void restore()}
            className="mr-4 underline"
          >
            Restore draft
          </button>
          <button
            type="button"
            disabled={restoring}
            onClick={() => {
              generation.current++;
              if (key)
                try {
                  localStorage.removeItem(key);
                } catch {}
              setRecovery(null);
              setPassword("");
            }}
          >
            Discard draft
          </button>
        </div>
      )}
      <textarea
        ref={ref}
        className={cn(
          "min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
          className,
        )}
        {...props}
        readOnly={props.readOnly || Boolean(recovery)}
        hidden={preview}
        onChange={(event) => {
          userEdited.current = true;
          onChange?.(event);
        }}
      />
      {preview && !props.disabled && (
        <div className="min-h-28 rounded-lg border border-input bg-card px-3 py-3">
          <MarkdownView>{String(props.value || "") || "Nothing to preview yet."}</MarkdownView>
        </div>
      )}
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}. Drafts expire after 30 days and are removed on sign out.
        </p>
      )}
    </div>
  );
});

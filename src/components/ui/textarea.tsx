import {
  type ChangeEvent,
  type TextareaHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bold,
  CheckSquare,
  Code,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownView } from "@/components/markdown-view";
import { useEditorDraftContext } from "@/components/editor-draft-context";
import { draftTitle, editorDraftKey, readEditorDraft, type EditorDraft } from "@/lib/editor-drafts";
import { encryptNote, decryptNote, unlockPrivateKey } from "@/lib/vault-crypto";
import {
  applyMarkdownKeyCommand,
  applyMarkdownToolbarAction,
  normalizeTabIndent,
  type MarkdownToolbarAction,
} from "@/lib/markdown-editor";

const TOOLBAR_ITEMS: {
  action: MarkdownToolbarAction;
  label: string;
  icon: typeof Bold;
}[] = [
  { action: "heading", label: "Heading", icon: Heading },
  { action: "bold", label: "Bold", icon: Bold },
  { action: "italic", label: "Italic", icon: Italic },
  { action: "bullet-list", label: "Bullet list", icon: List },
  { action: "numbered-list", label: "Numbered list", icon: ListOrdered },
  { action: "checklist", label: "Checklist", icon: CheckSquare },
  { action: "link", label: "Link", icon: Link2 },
  { action: "code", label: "Code", icon: Code },
  { action: "quote", label: "Quote", icon: Quote },
];

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    draftId?: string;
    draftName?: string;
    sensitive?: boolean;
    encryptedDraftOnly?: boolean;
    markdownToolbar?: boolean;
    onValueChange?: (value: string) => void;
    onRestoreDraft?: (body: string, encrypted: boolean) => void;
  }
>(function Textarea(
  {
    className,
    draftId,
    draftName,
    sensitive = false,
    encryptedDraftOnly = false,
    markdownToolbar = false,
    onValueChange,
    onRestoreDraft,
    onChange,
    onKeyDown,
    ...props
  },
  ref,
) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
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
  function emitEdit(nextValue: string, selectionStart: number, selectionEnd: number) {
    userEdited.current = true;
    onValueChange?.(nextValue);
    if (onChange) {
      const target = internalRef.current ?? ({ value: nextValue } as HTMLTextAreaElement);
      target.value = nextValue;
      onChange({
        target,
        currentTarget: target,
      } as ChangeEvent<HTMLTextAreaElement>);
    }
    requestAnimationFrame(() => {
      const el = internalRef.current;
      if (el && !preview) {
        el.focus();
        try {
          el.setSelectionRange(selectionStart, selectionEnd);
        } catch {}
      }
    });
  }

  function handleToolbarAction(action: MarkdownToolbarAction) {
    if (props.disabled || props.readOnly || Boolean(recovery)) return;
    const current = String(props.value ?? internalRef.current?.value ?? "");
    const el = internalRef.current;
    const start = el ? el.selectionStart : current.length;
    const end = el ? el.selectionEnd : current.length;
    const result = applyMarkdownToolbarAction(current, start, end, action);
    if (preview) setPreview(false);
    emitEdit(result.value, result.selectionStart, result.selectionEnd);
  }

  const isMono = Boolean(className?.includes("font-mono"));

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
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
          {markdownToolbar && (
            <div
              role="toolbar"
              aria-label="Markdown formatting"
              className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
            >
              {TOOLBAR_ITEMS.map(({ action, label, icon: Icon }) => (
                <button
                  key={action}
                  type="button"
                  aria-label={label}
                  title={label}
                  disabled={props.disabled || props.readOnly || Boolean(recovery)}
                  onClick={() => handleToolbarAction(action)}
                  className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
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
        ref={setTextareaRef}
        style={{ tabSize: 2, ...props.style }}
        className={cn(
          "min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
          className,
        )}
        {...props}
        readOnly={props.readOnly || Boolean(recovery)}
        hidden={preview}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || props.disabled || props.readOnly || Boolean(recovery)) {
            return;
          }
          if (
            markdownToolbar &&
            (event.key === "Tab" || (event.key === "Enter" && !event.metaKey && !event.ctrlKey))
          ) {
            const el = event.currentTarget;
            const current = String(props.value ?? el.value ?? "");
            const command = applyMarkdownKeyCommand(
              current,
              el.selectionStart,
              el.selectionEnd,
              event.key,
              event.shiftKey,
            );
            if (command) {
              event.preventDefault();
              emitEdit(command.value, command.selectionStart, command.selectionEnd);
            }
          }
        }}
        onChange={(event) => {
          userEdited.current = true;
          if (markdownToolbar && event.target.value.includes("\t")) {
            event.target.value = normalizeTabIndent(event.target.value);
          }
          onValueChange?.(event.target.value);
          onChange?.(event);
        }}
      />
      {preview && !props.disabled && (
        <div
          className={cn(
            "min-h-28 rounded-lg border border-input bg-card px-3 py-3",
            isMono && "font-mono",
          )}
        >
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

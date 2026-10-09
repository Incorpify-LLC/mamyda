import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  History,
  MessageSquare,
  Paperclip,
  Plus,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogDescription as SheetDescription,
  DialogTitle as SheetTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TurnstileField } from "@/components/turnstile-field";
import { useVerifiedToken } from "@/components/submission-verification";
import {
  chatSecurityReducer,
  chatTurnstileAction,
  initialChatSecurity,
  plainChatSave,
} from "@/lib/chat-experience";
import { parseChatBlob, type ChatMessage, type LLMSettings } from "@/lib/llm-config";
import type { ChatMeta } from "@/lib/mamyda/chat.server";
import { toast } from "sonner";

type Effort = "default" | "low" | "medium" | "high";
type Context = { label: string; body: string };
export type ChatContextItem = {
  id: string;
  kind: "task" | "note" | "minute" | "file";
  title: string;
  encrypted: boolean;
};
export type LoadedChat = {
  id: string;
  date: string;
  title: string;
  tags: string[];
  revision: number;
  encrypted: boolean;
  body: string;
};
export type ChatServices = {
  load: (id: string) => Promise<LoadedChat>;
  save: (data: ReturnType<typeof plainChatSave>, token: string) => Promise<LoadedChat>;
  ask: (
    data: {
      kind: "chat";
      selection: {
        provider: LLMSettings["provider"];
        configuredModel: string;
        model: string;
        effort: Effort;
      };
      body: string;
      history: ChatMessage[];
      context: Context[];
      consent: true;
    },
    token: string,
  ) => Promise<{ text: string }>;
  readContext: (item: ChatContextItem, password: string) => Promise<string>;
  unlock: (id: string, password: string) => Promise<string>;
};
type Props = {
  settings?: LLMSettings;
  settingsLoading: boolean;
  settingsError: boolean;
  retrySettings: () => void;
  archive: ChatMeta[];
  archiveLoading: boolean;
  archiveError: boolean;
  retryArchive: () => void;
  contexts: ChatContextItem[];
  contextsLoading: boolean;
  contextsError: boolean;
  retryContexts: () => void;
  search: string;
  onSearch: (value: string) => void;
  onSaved: () => void;
  services: ChatServices;
};

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function LLMChatWorkspace(props: Props) {
  const { settings, services } = props;
  const [day, setDay] = useState(localDay),
    [title, setTitle] = useState("Daily chat"),
    [tags, setTags] = useState("");
  const [id, setId] = useState<string>(),
    [revision, setRevision] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [question, setQuestion] = useState("");
  const [encrypted, setEncrypted] = useState(false),
    [unlocked, setUnlocked] = useState(false);
  const [model, setModel] = useState(settings?.model ?? ""),
    [effort, setEffort] = useState<Effort>("default");
  const [context, setContext] = useState<Context[]>([]),
    [selected, setSelected] = useState("");
  const [contextSearch, setContextSearch] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false),
    [unlockOpen, setUnlockOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false),
    [consent, setConsent] = useState(false);
  const [security, dispatchSecurity] = useReducer(chatSecurityReducer, initialChatSecurity);
  const verify = useVerifiedToken();
  const inFlight = useRef(false),
    transcriptEnd = useRef<HTMLDivElement>(null);
  const canAsk = Boolean(
    settings?.enabled &&
    settings.hasKey &&
    model.trim() &&
    question.trim() &&
    messages.length <= 78 &&
    !encrypted,
  );
  const selectedItem = props.contexts.find((item) => `${item.kind}:${item.id}` === selected);

  const onToken = useCallback(
    (token: string) => {
      dispatchSecurity({ type: "token", generation: security.generation, token });
    },
    [security.generation],
  );
  useEffect(() => {
    setModel(settings?.model ?? "");
    setConsent(false);
    dispatchSecurity({ type: "close" });
  }, [settings?.provider, settings?.model, settings?.enabled, settings?.hasKey]);
  useEffect(() => {
    if (messages.length)
      transcriptEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);
  useBlocker({
    shouldBlockFn: () =>
      busy ||
      ((dirty || Boolean(question.trim())) && !window.confirm("Leave and discard unsaved chat?")),
    enableBeforeUnload: busy || dirty || Boolean(question.trim()),
  });

  function closeSubmission() {
    dispatchSecurity({ type: "close" });
    setConsent(false);
  }
  function mayLeave() {
    return (
      !busy && (!(dirty || question.trim()) || window.confirm("Discard unsaved chat and question?"))
    );
  }
  function reset() {
    if (!mayLeave()) return;
    closeSubmission();
    setId(undefined);
    setRevision(0);
    setDay(localDay());
    setTitle("Daily chat");
    setTags("");
    setMessages([]);
    setQuestion("");
    setEncrypted(false);
    setUnlocked(false);
    setDirty(false);
    setContext([]);
    setSelected("");
    setPassword("");
    setError("");
    setOptionsOpen(false);
  }
  async function open(savedId: string) {
    if (!mayLeave()) return;
    setBusy(true);
    try {
      const row = await services.load(savedId);
      const next = row.encrypted ? [] : parseChatBlob(row.body);
      closeSubmission();
      setDay(row.date);
      setTitle(row.title);
      setTags(row.tags.join(", "));
      setId(row.id);
      setRevision(row.revision);
      setMessages(next);
      setEncrypted(row.encrypted);
      setUnlocked(false);
      setDirty(false);
      setQuestion("");
      setContext([]);
      setSelected("");
      setPassword("");
      setError("");
      setHistoryOpen(false);
      setOptionsOpen(false);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not open chat");
    } finally {
      setBusy(false);
    }
  }
  function begin(action: "ask" | "save") {
    if (busy || encrypted || (action === "ask" ? !canAsk : !messages.length)) return;
    setConsent(false);
    setError("");
    dispatchSecurity({ type: "begin", action });
  }
  async function submit() {
    if (inFlight.current || !security.action || encrypted) return;
    if (security.action === "ask" && !security.token) return;
    if (security.action === "ask" && (!canAsk || !consent || !settings)) return;
    if (security.action === "save" && (!messages.length || !title.trim() || !day)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (security.action === "ask" && settings) {
        const result = await services.ask(
          {
            kind: "chat",
            selection: {
              provider: settings.provider,
              configuredModel: settings.model,
              model: model.trim(),
              effort,
            },
            body: question,
            history: messages,
            context,
            consent: true,
          },
          security.token,
        );
        const next: ChatMessage[] = [
          ...messages,
          { role: "user", content: question, context: context.map((item) => item.label) },
          { role: "assistant", content: result.text, model: model.trim(), effort },
        ];
        parseChatBlob(JSON.stringify({ version: 1, messages: next }));
        setMessages(next);
        setQuestion("");
        setDirty(true);
      } else {
        const token = await verify("chat-save", "Saving daily chat");
        const saved = await services.save(
          plainChatSave({ id, date: day, title, tags, revision, messages, encrypted }),
          token,
        );
        setId(saved.id);
        setRevision(saved.revision);
        setDirty(false);
        props.onSaved();
        toast.success("Daily chat saved");
      }
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "Request failed";
      setError(`${detail} Your draft is kept. Try again when you’re ready.`);
    } finally {
      inFlight.current = false;
      setBusy(false);
      closeSubmission();
    }
  }

  return (
    <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{id ? title : "Your conversation"}</p>
          <p className="text-xs text-muted-foreground">
            {encrypted
              ? "Previously encrypted archive · read-only"
              : dirty
                ? "Unsaved · save when you’re ready"
                : id
                  ? `${day} · Saved`
                  : "Nothing is sent or saved automatically"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>
            <Plus className="size-4" aria-hidden="true" />
            New chat
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setHistoryOpen(true)}>
            <History className="size-4" aria-hidden="true" />
            Saved chats
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || encrypted || !messages.length}
            onClick={() => begin("save")}
          >
            <Save className="size-4" aria-hidden="true" />
            Save chat
          </Button>
        </div>
      </div>

      {encrypted && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="max-w-lg text-muted-foreground">
            This earlier chat stays encrypted. Open it with its original passphrase to read it; new
            chats no longer have encryption controls.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setPassword("");
              if (unlocked) {
                setMessages([]);
                setUnlocked(false);
              } else setUnlockOpen(true);
            }}
          >
            {unlocked ? "Close saved content" : "Open saved chat"}
          </Button>
        </div>
      )}

      <section
        aria-label="Conversation"
        aria-live="polite"
        aria-busy={busy && security.action === "ask"}
        className="min-h-48 space-y-7 py-3 sm:min-h-64"
      >
        {!messages.length && !encrypted && (
          <div className="py-8 text-center sm:py-12">
            <MessageSquare
              className="mx-auto mb-4 size-7 text-muted-foreground"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              What would you like to work on?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask a question, or bring in a task, note, meeting or file.
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <article key={index} className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {message.role === "user" ? "You" : "Assistant"}
              {message.role === "assistant" && message.model ? ` · ${message.model}` : ""}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
            {Boolean(message.context?.length) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Context: {message.context?.join("; ")}
              </p>
            )}
          </article>
        ))}
        <div ref={transcriptEnd} />
      </section>

      {!encrypted && (
        <div className="space-y-3">
          {props.settingsLoading && (
            <p className="text-sm text-muted-foreground" role="status">
              Loading model configuration…
            </p>
          )}
          {props.settingsError && (
            <p role="alert" className="text-sm">
              Model settings could not be loaded.{" "}
              <Button variant="ghost" size="sm" onClick={props.retrySettings}>
                Retry settings
              </Button>
            </p>
          )}
          {settings && (!settings.enabled || !settings.hasKey) && (
            <p className="text-sm text-muted-foreground">
              Choose and enable your model in{" "}
              <Link
                to="/settings"
                search={{ section: "llm" }}
                className="underline underline-offset-4"
              >
                Settings → LLM
              </Link>{" "}
              to start chatting.
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              begin("ask");
            }}
            className="rounded-xl border bg-card p-3 shadow-sm sm:p-4"
          >
            <Label htmlFor="chat-question" className="sr-only">
              Question
            </Label>
            <Textarea
              id="chat-question"
              value={question}
              disabled={busy}
              maxLength={20000}
              placeholder="Ask a question…"
              className="min-h-24 resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              onChange={(event) => setQuestion(event.target.value)}
            />
            {context.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {context.map((item, index) => (
                  <span
                    key={index}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                  >
                    <span className="truncate">{item.label}</span>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Remove ${item.label}`}
                      className="cursor-pointer rounded-full p-1 hover:bg-background"
                      onClick={() => setContext((old) => old.filter((_, i) => i !== index))}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <button
                type="button"
                disabled={busy}
                aria-expanded={optionsOpen}
                aria-controls="chat-options"
                className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setOptionsOpen((value) => !value)}
              >
                <Paperclip className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{model || "Model & context"}</span>
                <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
              </button>
              <Button type="submit" size="sm" disabled={busy || !canAsk}>
                <ArrowUp className="size-4" aria-hidden="true" />
                {busy && security.action === "ask" ? "Asking…" : "Ask model"}
              </Button>
            </div>
          </form>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Review replies before relying on them. Save chats explicitly to keep them.
          </p>

          {optionsOpen && (
            <fieldset id="chat-options" disabled={busy} className="space-y-4 border-t pt-4">
              <legend className="sr-only">Model and context options</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="chat-model">Model ID</Label>
                  <Input
                    id="chat-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="chat-effort">Reasoning effort</Label>
                  <select
                    id="chat-effort"
                    value={effort}
                    onChange={(event) => setEffort(event.target.value as Effort)}
                    className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  >
                    {["default", "low", "medium", "high"].map((value) => (
                      <option key={value} value={value}>
                        {value === "default" ? "Model default" : value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings?.provider ?? "Your provider"} · Uses your{" "}
                <Link
                  to="/settings"
                  search={{ section: "llm" }}
                  className="underline underline-offset-4"
                >
                  LLM settings
                </Link>
                . Effort support varies by model; higher effort may cost more.
              </p>
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Attach context{" "}
                  <span className="font-normal text-muted-foreground">({context.length}/8)</span>
                </p>
                {props.contextsLoading && (
                  <p className="text-xs text-muted-foreground">Loading context…</p>
                )}
                {props.contextsError && (
                  <p className="text-sm" role="alert">
                    Context could not be loaded.{" "}
                    <Button variant="ghost" size="sm" onClick={props.retryContexts}>
                      Retry context
                    </Button>
                  </p>
                )}
                <Input
                  aria-label="Find context"
                  placeholder="Find a task, note, meeting or file"
                  value={contextSearch}
                  onChange={(event) => setContextSearch(event.target.value)}
                />
                <select
                  aria-label="Context item"
                  value={selected}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    setPassword("");
                  }}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                >
                  <option value="">Select an item…</option>
                  {props.contexts
                    .filter((item) =>
                      item.title.toLowerCase().includes(contextSearch.toLowerCase()),
                    )
                    .map((item) => (
                      <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                        {item.encrypted ? "🔒 " : ""}
                        {item.kind} · {item.title}
                      </option>
                    ))}
                </select>
                {selectedItem?.encrypted && (
                  <Input
                    type="password"
                    autoComplete="off"
                    aria-label="Context Vault passphrase"
                    placeholder="Passphrase for this protected item"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !selectedItem ||
                    context.length >= 8 ||
                    context.some(
                      (item) => item.label === `${selectedItem.kind}: ${selectedItem.title}`,
                    )
                  }
                  onClick={async () => {
                    if (!selectedItem) return;
                    setBusy(true);
                    try {
                      const body = await services.readContext(selectedItem, password);
                      if (!body.trim() || body.length > 20000)
                        throw new Error("Context must contain 1–20,000 characters");
                      setContext((old) => [
                        ...old,
                        { label: `${selectedItem.kind}: ${selectedItem.title}`, body },
                      ]);
                      setSelected("");
                    } catch (failure) {
                      toast.error(
                        failure instanceof Error ? failure.message : "Could not add context",
                      );
                    } finally {
                      setBusy(false);
                      setPassword("");
                    }
                  }}
                >
                  Attach selected item
                </Button>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX or UTF-8 text; up to 20,000 characters per excerpt. Protected task/note
                  content still needs its passphrase. Excerpts are sent only when you confirm asking
                  the model.
                </p>
                {context.map((item, index) => (
                  <details key={index} className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Preview {item.label}
                    </summary>
                    <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                      {item.body}
                    </p>
                  </details>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      <Sheet
        open={historyOpen}
        onOpenChange={(value) => {
          if (!busy) setHistoryOpen(value);
        }}
      >
        <SheetContent side="right" className="flex flex-col gap-4 overflow-y-auto">
          <SheetTitle>Saved chats</SheetTitle>
          <SheetDescription>Find a daily chat by text, title, date or tags.</SheetDescription>
          <Input
            aria-label="Search saved chats"
            placeholder="Search your chats…"
            value={props.search}
            maxLength={200}
            onChange={(event) => props.onSearch(event.target.value)}
          />
          {props.archiveLoading && (
            <p className="text-sm text-muted-foreground">Loading saved chats…</p>
          )}
          {props.archiveError && (
            <p role="alert" className="text-sm">
              Saved chats could not be loaded.{" "}
              <Button size="sm" variant="ghost" onClick={props.retryArchive}>
                Retry archive
              </Button>
            </p>
          )}
          {!props.archiveLoading && !props.archiveError && !props.archive.length && (
            <p className="text-sm text-muted-foreground">
              {props.search
                ? "No matching chats. Try a different search."
                : "No saved chats yet. Save a conversation to keep it here."}
            </p>
          )}
          <div className="space-y-1">
            {props.archive.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={busy}
                aria-current={row.id === id ? "true" : undefined}
                className="w-full cursor-pointer rounded-md px-3 py-3 text-left text-sm hover:bg-muted aria-[current=true]:bg-muted"
                onClick={() => void open(row.id)}
              >
                <span className="block break-words font-medium">
                  {row.encrypted ? "🔒 " : ""}
                  {row.title}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.chat_date}
                  {row.tags.length ? ` · ${row.tags.join(", ")}` : ""}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(security.action)}
        onOpenChange={(value) => {
          if (!value && !busy) closeSubmission();
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            {security.action === "ask" ? "Ready to ask the model?" : "Save daily chat"}
          </DialogTitle>
          <DialogDescription>
            {security.action === "ask"
              ? "Complete the security check, then choose Ask Model now. Nothing is sent until you confirm."
              : "Choose how this conversation appears in Saved chats. Save chat now checks and saves in one step."}
          </DialogDescription>
          {security.action === "save" && (
            <fieldset disabled={busy} className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="chat-title">Chat title</Label>
                <Input
                  id="chat-title"
                  value={title}
                  maxLength={120}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chat-day">Archive date</Label>
                <Input
                  id="chat-day"
                  type="date"
                  value={day}
                  disabled={Boolean(id)}
                  onChange={(event) => {
                    setDay(event.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chat-tags">Tags (comma separated)</Label>
                <Input
                  id="chat-tags"
                  value={tags}
                  onChange={(event) => {
                    setTags(event.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                One saved conversation per date. Chat text is searchable. Attached excerpts aren’t
                saved; only their labels are kept.
              </p>
            </fieldset>
          )}
          {security.action === "ask" && (
            <label className="my-4 flex items-start gap-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I agree to send this question, chat history and{" "}
                {context.length
                  ? `${context.length} attached excerpt${context.length === 1 ? "" : "s"}`
                  : "no attached excerpts"}{" "}
                to{" "}
                <strong className="font-medium">
                  {settings?.provider} / {model}
                </strong>
                . Provider privacy policies and API charges apply
                {effort !== "default" ? ` (${effort} effort)` : ""}. Readable protected context is
                included if attached.
              </span>
            </label>
          )}
          {security.action === "ask" && (
            <div className="my-4">
              <TurnstileField
                key={security.generation}
                action={chatTurnstileAction(security.action)}
                resetKey={security.generation}
                onToken={onToken}
                size="compact"
                refreshExpired="manual"
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={closeSubmission}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                (security.action === "ask" && !security.token) ||
                (security.action === "ask"
                  ? !consent || !canAsk
                  : !messages.length || !title.trim() || !day)
              }
              onClick={() => void submit()}
            >
              {busy
                ? security.action === "ask"
                  ? "Asking model…"
                  : "Saving…"
                : security.action === "ask"
                  ? "Ask Model now"
                  : "Save chat now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unlockOpen}
        onOpenChange={(value) => {
          if (!busy) {
            setUnlockOpen(value);
            setPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Open previously encrypted chat</DialogTitle>
          <DialogDescription>
            Your original passphrase opens a read-only view. This does not remove encryption from
            the saved archive.
          </DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!id || !password || busy) return;
              setBusy(true);
              try {
                const body = await services.unlock(id, password);
                setMessages(parseChatBlob(body));
                setUnlocked(true);
                setUnlockOpen(false);
              } catch (failure) {
                toast.error(
                  failure instanceof Error ? failure.message : "Could not open saved content",
                );
              } finally {
                setBusy(false);
                setPassword("");
              }
            }}
          >
            <Label htmlFor="legacy-chat-passphrase">Original Vault passphrase</Label>
            <Input
              id="legacy-chat-passphrase"
              type="password"
              autoComplete="off"
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" disabled={busy || !password}>
              {busy ? "Opening…" : "Open read-only"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

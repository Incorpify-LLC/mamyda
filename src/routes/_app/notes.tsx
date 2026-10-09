import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deleteNote, saveNote } from "@/lib/mamyda/writing";
import { useNotes, useWorkspace } from "@/lib/mamyda/hooks";
import { extractTags, titleFromBody } from "@/lib/tags";
import { ContentProtection } from "@/components/content-protection";
import { encryptPrivateContent } from "@/lib/content-crypto";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Note } from "@/lib/mamyda/types";
import { useWritingDraft } from "@/components/writing-draft";
import { useVerifiedToken } from "@/components/submission-verification";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LLMEditButton } from "@/components/llm-edit-button";
import { boardSearchContext } from "@/lib/board-navigation";

export const Route = createFileRoute("/_app/notes")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...boardSearchContext(search),
    ...(typeof search.noteId === "string" ? { noteId: search.noteId } : {}),
  }),
  component: NotesPage,
});

function NotesPage() {
  const search = Route.useSearch();
  const list = useNotes();
  const ws = useWorkspace();
  const [filter, setFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(search.projectId ?? null);
  const [current, setCurrent] = useState<Note | null>(null);
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => setTitleDraft(current?.title ?? ""), [current?.id, current?.title]);
  const [encryptContent, setEncryptContent] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [llmBusy, setLLMBusy] = useState(false);
  useEffect(() => {
    setEncryptContent(Boolean(current?.encrypted));
    setUnlocked(false);
  }, [current?.id, current?.encrypted]);
  const verify = useVerifiedToken();

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of list.data ?? []) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [list.data]);

  const visible = (list.data ?? []).filter(
    (n) =>
      (!filter || n.tags.includes(filter)) &&
      (!projectFilter || n.projectId === projectFilter) &&
      (!search.clientId ||
        ws.data?.projects.some((p) => p.id === n.projectId && p.clientId === search.clientId)),
  );

  useEffect(() => {
    setProjectFilter(search.projectId ?? null);
  }, [search.projectId]);

  const projectById = useMemo(
    () => new Map((ws.data?.projects ?? []).map((p) => [p.id, p])),
    [ws.data],
  );

  const liveTags = extractTags(current ? draft : "");

  useEffect(() => {
    if (!search.noteId || !list.data) return;
    const match = list.data.find((note) => note.id === search.noteId);
    if (match && current?.id !== match.id) {
      setCurrent(match);
      setDraft(match.body);
    }
  }, [search.noteId, list.data, current?.id]);

  async function persist() {
    if (current?.encrypted && !unlocked) throw new Error("Unlock content before saving");
    const encryption = encryptContent
      ? await encryptPrivateContent(draft, ws.data?.profile.vaultPublicKey)
      : undefined;
    const captcha = await verify("note-save", "Saving note");
    const next = await saveNote({
      data: {
        id: current?.id || undefined,
        body: encryption ? "" : draft,
        projectId: current?.projectId ?? null,
        ...(encryption
          ? {
              encryption,
              title: titleDraft.trim() || "Untitled",
              tags: extractTags(draft),
            }
          : { title: titleDraft.trim() || titleFromBody(draft) }),
      },
      headers: captcha ? { "x-turnstile-response": captcha } : undefined,
    });
    const saved = next.notes.find((n) => n.id === next.id);
    if (!saved)
      throw new Error("Could not identify the saved note. Reload your notes before retrying.");
    setCurrent(saved);
    setDraft(saved.body);
    setUnlocked(false);
    void list.refetch();
    toast.success("Note saved");
  }
  const protection = useWritingDraft({
    locked: llmBusy,
    ephemeral: encryptContent || Boolean(current?.encrypted),
    kind: "notes",
    value: {
      id: current?.id ?? "",
      body: draft,
      projectId: current?.projectId ?? null,
      title: titleDraft,
    },
    baseline: {
      id: current?.id ?? "",
      body: current?.body ?? "",
      projectId: current?.projectId ?? null,
      title: current?.title ?? "",
    },
    persist,
    restore: (value, baseline) => {
      const saved = (list.data ?? []).find((n) => n.id === value.id);
      if (saved?.encrypted) {
        setCurrent(saved);
        setDraft("");
        setTitleDraft(saved.title);
        setUnlocked(false);
        toast.warning(
          "This note is encrypted now. Its earlier plaintext draft was not opened; unlock the saved content with your passphrase.",
        );
        return;
      }
      setCurrent({
        id: value.id,
        title: "",
        tags: [],
        createdAt: "",
        updatedAt: "",
        ...saved,
        body: baseline.body,
        projectId: value.projectId ?? saved?.projectId ?? null,
      });
      setDraft(value.body);
      setTitleDraft(value.title || saved?.title || "");
    },
  });

  return (
    <AppShell
      title="Notes"
      action={
        <Button
          size="sm"
          disabled={protection.saving || protection.recoveryPending}
          onClick={() =>
            protection.request(() => {
              setCurrent({
                id: "",
                projectId: search.projectId ?? null,
                title: "",
                body: "",
                tags: [],
                createdAt: "",
                updatedAt: "",
              });
              setDraft("");
            })
          }
        >
          New
        </Button>
      }
    >
      {protection.dialog}
      <p className="mb-4 text-sm text-muted-foreground">
        Link a note to a project below, or use #project-slug in the text. Free tags still work.
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs",
            !filter ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          All
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs",
              filter === t ? "bg-foreground text-background" : "bg-muted",
            )}
          >
            #{t}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter notes by project">
        <button
          type="button"
          onClick={() => setProjectFilter(null)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs",
            !projectFilter ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          All projects
        </button>
        {(ws.data?.projects ?? [])
          .filter((project) => (list.data ?? []).some((note) => note.projectId === project.id))
          .map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setProjectFilter(project.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                projectFilter === project.id ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {project.name}
              {project.archived ? " · archived" : ""}
            </button>
          ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-2">
          {visible.map((n) => (
            <button
              key={n.id}
              type="button"
              disabled={protection.saving || protection.recoveryPending || llmBusy}
              onClick={() =>
                protection.request(() => {
                  setCurrent(n);
                  setDraft(n.body);
                })
              }
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left",
                current?.id === n.id ? "border-primary bg-card" : "border-border bg-card/60",
              )}
            >
              <p className="text-sm font-medium">{n.title}</p>
              {n.encrypted && <p className="text-xs text-muted-foreground">🔒 Content encrypted</p>}
              <p className="text-xs text-muted-foreground">
                {n.updatedAt ? formatDay(n.updatedAt) : ""}
                {n.projectId ? ` · ${projectById.get(n.projectId)?.name ?? ""}` : ""}
              </p>
            </button>
          ))}
        </div>

        {current ? (
          <Card className="p-5">
            <Label htmlFor="note-visible-title">Note name (visible while encrypted)</Label>
            <Input
              id="note-visible-title"
              className="mb-3"
              value={titleDraft}
              disabled={protection.saving || (Boolean(current.encrypted) && !unlocked)}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Untitled"
            />
            <ContentProtection
              key={current.id || "new-note"}
              profile={ws.data?.profile}
              kind="note"
              id={current.id}
              encrypted={Boolean(current.encrypted)}
              enabled={encryptContent}
              unlocked={unlocked}
              disabled={protection.saving || protection.recoveryPending || llmBusy}
              onToggle={setEncryptContent}
              onUnlock={(body) => {
                setDraft(body);
                setCurrent({ ...current, body });
                setUnlocked(true);
              }}
              onLock={() => {
                if (
                  draft !== current.body &&
                  !window.confirm("Discard unsaved changes and lock this note?")
                )
                  return;
                setDraft("");
                setCurrent({ ...current, body: "" });
                setUnlocked(false);
                protection.clear();
              }}
            />
            <Textarea
              aria-label="Note body"
              disabled={
                protection.saving ||
                llmBusy ||
                protection.recoveryPending ||
                (Boolean(current.encrypted) && !unlocked)
              }
              className="min-h-72 font-sans"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                current.encrypted && !unlocked
                  ? "Encrypted content — unlock to view"
                  : "Write. Use #tags."
              }
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {liveTags.map((t) => (
                <Badge
                  key={t}
                  tone={
                    projectById.has(t) || [...projectById.values()].some((p) => p.slug === t)
                      ? "primary"
                      : "muted"
                  }
                >
                  #{t}
                </Badge>
              ))}
            </div>
            <div className="mt-4 max-w-sm space-y-1.5">
              <Label htmlFor="note-project">Project</Label>
              <select
                id="note-project"
                aria-label="Link note to project"
                disabled={protection.saving || protection.recoveryPending}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={current.projectId ?? ""}
                onChange={(e) => setCurrent({ ...current, projectId: e.target.value || null })}
              >
                <option value="">No project</option>
                {current.projectId && projectById.get(current.projectId)?.archived && (
                  <option value={current.projectId}>
                    {projectById.get(current.projectId)?.name} (archived)
                  </option>
                )}
                {(ws.data?.projects ?? [])
                  .filter((project) => !project.archived)
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <LLMEditButton
                title={titleDraft}
                body={draft}
                disabled={
                  protection.saving ||
                  protection.recoveryPending ||
                  llmBusy ||
                  (Boolean(current.encrypted) && !unlocked)
                }
                onBusyChange={setLLMBusy}
                onEdited={setDraft}
              />
              <LLMEditButton
                kind="spellcheck"
                label="Correct spelling with LLM"
                title={titleDraft}
                body={draft}
                disabled={
                  protection.saving ||
                  protection.recoveryPending ||
                  llmBusy ||
                  (Boolean(current.encrypted) && !unlocked)
                }
                onBusyChange={setLLMBusy}
                onEdited={setDraft}
              />
              <Button
                disabled={
                  protection.saving ||
                  llmBusy ||
                  (Boolean(current.encrypted) && !unlocked) ||
                  protection.recoveryPending
                }
                onClick={() => void protection.save()}
              >
                {protection.saving ? "Saving…" : "Save"}
              </Button>
              {current.id && (
                <Button
                  variant="ghost"
                  disabled={protection.saving || protection.recoveryPending || llmBusy}
                  onClick={async () => {
                    if (!window.confirm("Delete this note and any unsaved changes?")) return;
                    try {
                      await deleteNote({ data: current.id });
                      protection.clear();
                      setCurrent(null);
                      setDraft("");
                      await list.refetch();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Delete failed; your note was kept.",
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Select a note, or write a new one.</p>
        )}
      </div>
    </AppShell>
  );
}

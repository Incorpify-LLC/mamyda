import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deleteNote, saveNote } from "@/lib/mamyda/writing";
import { useNotes, useWorkspace } from "@/lib/mamyda/hooks";
import { extractTags } from "@/lib/tags";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Note } from "@/lib/mamyda/types";

export const Route = createFileRoute("/_app/notes")({ component: NotesPage });

function NotesPage() {
  const list = useNotes();
  const ws = useWorkspace();
  const [filter, setFilter] = useState<string | null>(null);
  const [current, setCurrent] = useState<Note | null>(null);
  const [draft, setDraft] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of list.data ?? []) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [list.data]);

  const visible = (list.data ?? []).filter((n) =>
    filter ? n.tags.includes(filter) : true,
  );

  const projectById = useMemo(
    () => new Map((ws.data?.projects ?? []).map((p) => [p.id, p])),
    [ws.data],
  );

  const liveTags = extractTags(current ? draft : "");

  async function persist(id?: string, body?: string) {
    const next = await saveNote({
      data: { id, body: body ?? draft },
    });
    list.refetch();
    toast.success("Note saved");
    return next;
  }

  return (
    <AppShell
      title="Notes"
      action={
        <Button
          size="sm"
          onClick={() => {
            setCurrent({
              id: "",
              projectId: null,
              title: "",
              body: "",
              tags: [],
              createdAt: "",
              updatedAt: "",
            });
            setDraft("");
          }}
        >
          New
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Tag with #project-slug to attach a note to a project. Free tags work too.
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

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-2">
          {visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setCurrent(n);
                setDraft(n.body);
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left",
                current?.id === n.id
                  ? "border-primary bg-card"
                  : "border-border bg-card/60",
              )}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">
                {n.updatedAt ? formatDay(n.updatedAt) : ""}
                {n.projectId ? ` · ${projectById.get(n.projectId)?.name ?? ""}` : ""}
              </p>
            </button>
          ))}
        </div>

        {current ? (
          <Card className="p-5">
            <Textarea
              className="min-h-72 font-sans"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write. Use #tags."
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {liveTags.map((t) => (
                <Badge key={t} tone={projectById.has(t) || [...projectById.values()].some((p) => p.slug === t) ? "primary" : "muted"}>
                  #{t}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={async () => {
                  const notes = await persist(current.id || undefined, draft);
                  const saved =
                    notes.find((n) => n.body === draft) ?? notes[0] ?? current;
                  setCurrent(saved);
                  setDraft(saved.body);
                }}
              >
                Save
              </Button>
              {current.id && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await deleteNote({ data: current.id });
                    setCurrent(null);
                    await list.refetch();
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

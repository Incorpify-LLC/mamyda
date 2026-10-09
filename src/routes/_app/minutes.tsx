import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useProjectContext } from "@/components/project-context";
import { EditorFeedback } from "@/components/editor-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteMinute, saveMinute } from "@/lib/mamyda/writing";
import { LLMEditButton } from "@/components/llm-edit-button";
import { MinuteRecordings } from "@/components/minute-recordings";
import { useCalendar, useMinutes, useWorkspace } from "@/lib/mamyda/hooks";
import { formatDay, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Minute } from "@/lib/mamyda/types";
import { useWritingDraft } from "@/components/writing-draft";
import { boardSearchContext } from "@/lib/board-navigation";
import { useVerifiedToken } from "@/components/submission-verification";

export const Route = createFileRoute("/_app/minutes")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...boardSearchContext(search),
    ...(typeof search.minuteId === "string" ? { minuteId: search.minuteId } : {}),
  }),
  component: MinutesPage,
});

function emptyMinute(): Minute {
  return {
    id: "",
    eventId: null,
    projectId: null,
    title: "",
    attendees: "",
    body: "",
    createdAt: "",
    updatedAt: "",
  };
}

function MinutesPage() {
  const verify = useVerifiedToken();
  const search = Route.useSearch();
  const list = useMinutes();
  const ws = useWorkspace();
  const context = useProjectContext(
    false,
    list.data?.find((item) => item.id === search.minuteId)?.projectId,
  );
  const cal = useCalendar();
  const [current, setCurrent] = useState<Minute>(() => ({
    ...emptyMinute(),
    projectId: context.project?.id ?? null,
  }));
  const [baseline, setBaseline] = useState<Minute>(() => ({
    ...emptyMinute(),
    projectId: context.project?.id ?? null,
  }));
  const scope = `${context.client?.id ?? ""}/${context.project?.id ?? ""}/${context.invalid}`;
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current !== scope && !search.minuteId) {
      const blank = { ...emptyMinute(), projectId: context.project?.id ?? null };
      setCurrent(blank);
      setBaseline(blank);
    }
    previousScope.current = scope;
  }, [scope, search.minuteId, context.project?.id]);
  const [polishing, setPolishing] = useState(false);
  const selectedId = current.id || null;

  useEffect(() => {
    if (!search.minuteId || !list.data) return;
    const match = list.data.find((minute) => minute.id === search.minuteId);
    if (match && current.id !== match.id) {
      setCurrent(match);
      setBaseline(match);
    }
  }, [search.minuteId, list.data, current.id]);

  const events = useMemo(() => cal.data?.events ?? [], [cal.data]);
  const visible = (list.data ?? []).filter(
    (m) =>
      !context.invalid &&
      (!context.project || m.projectId === context.project.id) &&
      (!context.client ||
        ws.data?.projects.some((p) => p.id === m.projectId && p.clientId === context.client?.id)),
  );

  async function persist() {
    if (context.invalid) throw new Error("Choose an active project before saving minutes.");
    const captcha = await verify("minute-save", "Saving minutes");
    const id = await saveMinute({
      data: {
        id: current.id || undefined,
        title: current.title,
        body: current.body,
        attendees: current.attendees,
        eventId: current.eventId,
        projectId: current.projectId,
      },
      headers: { "x-turnstile-response": captcha },
    });
    const saved = { ...current, id };
    setCurrent(saved);
    setBaseline(saved);
    void list.refetch();
    toast.success("Minutes saved");
  }
  const protection = useWritingDraft({
    kind: "minutes",
    value: current,
    baseline,
    persist,
    locked: polishing,
    restore: (value, original) => {
      setCurrent(value);
      setBaseline(original);
    },
  });
  function select(value: Minute) {
    protection.request(() => {
      setCurrent(value);
      setBaseline(value);
    });
  }

  return (
    <AppShell
      title="Minutes"
      boardContext={context.search}
      action={
        <Button
          size="sm"
          disabled={
            context.invalid ||
            context.loading ||
            protection.saving ||
            polishing ||
            protection.recoveryPending
          }
          onClick={() => select({ ...emptyMinute(), projectId: context.project?.id ?? null })}
        >
          New minutes
        </Button>
      }
    >
      {protection.dialog}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          <EditorFeedback
            loading={list.isPending || ws.isPending}
            error={list.isError || ws.isError}
            empty={!context.invalid && visible.length === 0}
            emptyText="No minutes in this view. Write below or choose New minutes."
            onRetry={() => {
              void ws.refetch();
              void list.refetch();
            }}
          />
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={protection.saving || polishing || protection.recoveryPending}
              onClick={() => select(m)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left",
                selectedId === m.id ? "border-primary bg-card" : "border-border bg-card/60",
              )}
            >
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">
                {m.updatedAt ? formatDay(m.updatedAt) : ""}
              </p>
            </button>
          ))}
        </div>

        <Card className="p-5">
          <MinuteRecordings
            disabled={protection.saving || polishing || protection.recoveryPending}
            canAccept={Boolean(current.id) && !protection.dirty}
            onBusyChange={setPolishing}
            onTranscript={(text) => {
              if (
                current.body.trim() &&
                !window.confirm(
                  "Append this transcript to the current minutes draft? Existing text will be kept.",
                )
              )
                return;
              const body = current.body.trim() ? `${current.body}\n\n${text}` : text;
              if (body.length > 100000) {
                toast.error("Combined minutes exceed 100,000 characters; start separate minutes");
                return;
              }
              setCurrent((c) => ({ ...c, body }));
              toast.success(
                "Transcript added to draft — review and Save before deleting the recording",
              );
            }}
          />
          <fieldset
            className="mt-4"
            disabled={protection.saving || polishing || protection.recoveryPending}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mtitle">Title</Label>
                <Input
                  id="mtitle"
                  value={current.title}
                  onChange={(e) => setCurrent((c) => ({ ...c, title: e.target.value }))}
                  placeholder="Kickoff, review, 1:1…"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mevent">Meeting</Label>
                  <select
                    id="mevent"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={current.eventId ?? ""}
                    onChange={(e) => {
                      const eventId = e.target.value || null;
                      const ev = events.find((x) => x.id === eventId);
                      setCurrent((c) => ({
                        ...c,
                        eventId,
                        title: c.title || ev?.title || c.title,
                        projectId: c.projectId || ev?.projectId || null,
                      }));
                    }}
                  >
                    <option value="">None</option>
                    {current.eventId && !events.some((ev) => ev.id === current.eventId) && (
                      <option value={current.eventId}>
                        Previously linked meeting (outside import window or removed)
                      </option>
                    )}
                    {events.slice(0, 40).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {formatDay(ev.startsAt)} {formatTime(ev.startsAt)} · {ev.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mproj">Project</Label>
                  <select
                    id="mproj"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={current.projectId ?? ""}
                    onChange={(e) =>
                      setCurrent((c) => ({
                        ...c,
                        projectId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {(ws.data?.projects ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="matt">Attendees</Label>
                <Input
                  id="matt"
                  value={current.attendees}
                  onChange={(e) => setCurrent((c) => ({ ...c, attendees: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mbody">Notes</Label>
                <Textarea
                  id="mbody"
                  className="min-h-56"
                  value={current.body}
                  onChange={(e) => setCurrent((c) => ({ ...c, body: e.target.value }))}
                  placeholder="Bullets are fine. Polish turns them into minutes."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={context.invalid || context.loading || protection.saving}
                  onClick={() => void protection.save()}
                >
                  {protection.saving ? "Saving…" : "Save"}
                </Button>
                <LLMEditButton
                  kind="minutes-polish"
                  title={current.title}
                  attendees={current.attendees}
                  body={current.body}
                  disabled={protection.saving || protection.recoveryPending}
                  onBusyChange={setPolishing}
                  onEdited={(text) => setCurrent((c) => ({ ...c, body: text }))}
                />
                <LLMEditButton
                  kind="spellcheck"
                  label="Correct spelling with LLM"
                  title={current.title}
                  body={current.body}
                  disabled={protection.saving || protection.recoveryPending}
                  onBusyChange={setPolishing}
                  onEdited={(text) => setCurrent((c) => ({ ...c, body: text }))}
                />
                {current.id && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm("Delete these minutes and any unsaved changes?")) return;
                      try {
                        await deleteMinute({ data: current.id });
                        protection.clear();
                        setCurrent(emptyMinute());
                        setBaseline(emptyMinute());
                        await list.refetch();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Delete failed; your minutes were kept.",
                        );
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </fieldset>
        </Card>
      </div>
    </AppShell>
  );
}

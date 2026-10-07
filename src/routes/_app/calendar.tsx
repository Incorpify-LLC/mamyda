import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, formatDay, formatDayKey, formatTime, startOfDay } from "@/lib/time";
import { useCalendar } from "@/lib/mamyda/hooks";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { syncCalendars } from "@/lib/mamyda/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileField, type TurnstileStatus } from "@/components/turnstile-field";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/mamyda/calendar";
import type { CalendarEvent } from "@/lib/mamyda/types";

export const Route = createFileRoute("/_app/calendar")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.eventId === "string" ? { eventId: search.eventId } : {}),
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const search = Route.useSearch();
  const cal = useCalendar();
  const ws = useWorkspace();
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [editor, setEditor] = useState<{
    eventId?: string;
    sourceId: string;
    title: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    projectId: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaStatus, setCaptchaStatus] = useState<TurnstileStatus>("unavailable");
  const [captchaKey, setCaptchaKey] = useState(0);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)), [cursor]);

  useEffect(() => {
    if (!search.eventId || !cal.data) return;
    const event = cal.data.events.find((item) => item.id === search.eventId);
    if (!event) return;
    const eventDay = startOfDay(new Date(event.startsAt));
    if (formatDayKey(cursor) !== formatDayKey(eventDay)) {
      setCursor(eventDay);
      return;
    }
    requestAnimationFrame(() =>
      document
        .getElementById(`calendar-event-${event.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [search.eventId, cal.data, cursor]);

  const grouped = useMemo(() => {
    const events = cal.data?.events ?? [];
    const byDay = new Map<string, typeof events>();
    for (const ev of events) {
      const key = formatDayKey(ev.startsAt);
      const list = byDay.get(key) ?? [];
      list.push(ev);
      byDay.set(key, list);
    }
    return byDay;
  }, [cal.data]);

  const projectName = (id: string | null) => ws.data?.projects.find((p) => p.id === id)?.name;
  const writableSources = (cal.data?.sources ?? []).filter(
    (source) =>
      source.enabled &&
      !source.icsUrl &&
      (source.provider === "google" || source.provider === "outlook"),
  );

  function localDateTime(value: string) {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function editEvent(event: CalendarEvent) {
    if (!event.sourceId || !writableSources.some((source) => source.id === event.sourceId)) {
      toast.error("Events from subscription feeds are read-only.");
      return;
    }
    setCaptchaToken("");
    setCaptchaStatus("loading");
    setCaptchaKey((value) => value + 1);
    setEditor({
      eventId: event.id,
      sourceId: event.sourceId,
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startsAt: event.allDay
        ? `${event.startsAt.slice(0, 10)}T00:00`
        : localDateTime(event.startsAt),
      endsAt: event.allDay
        ? `${(event.endsAt ?? event.startsAt).slice(0, 10)}T00:00`
        : localDateTime(event.endsAt ?? event.startsAt),
      allDay: event.allDay,
      projectId: event.projectId ?? "",
    });
  }

  function newEvent() {
    if (!writableSources.length) {
      toast.error("Connect Google or Microsoft Calendar in Settings to create events.");
      return;
    }
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60_000);
    setCaptchaToken("");
    setCaptchaStatus("loading");
    setCaptchaKey((value) => value + 1);
    setEditor({
      sourceId: writableSources[0]!.id,
      title: "",
      description: "",
      location: "",
      startsAt: localDateTime(start.toISOString()),
      endsAt: localDateTime(end.toISOString()),
      allDay: false,
      projectId: "",
    });
  }

  async function saveEvent() {
    if (!editor || saving) return;
    if (!captchaToken || captchaStatus !== "verified") {
      toast.error("Complete the security check before saving.");
      return;
    }
    setSaving(true);
    try {
      const toIso = (value: string) =>
        editor.allDay ? value.slice(0, 10) : new Date(value).toISOString();
      const data = {
        sourceId: editor.sourceId,
        eventId: editor.eventId,
        title: editor.title,
        description: editor.description,
        location: editor.location,
        startsAt: toIso(editor.startsAt),
        endsAt: toIso(editor.endsAt),
        allDay: editor.allDay,
        projectId: editor.projectId || null,
      };
      if (editor.eventId) {
        await updateCalendarEvent({
          data: { ...data, eventId: editor.eventId },
          headers: { "x-turnstile-response": captchaToken },
        });
      } else {
        await createCalendarEvent({ data, headers: { "x-turnstile-response": captchaToken } });
      }
      await cal.refetch();
      setEditor(null);
      toast.success(editor.eventId ? "Calendar event updated" : "Event added to your calendar");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the event. Your details are still here; retry.",
      );
      setCaptchaToken("");
      setCaptchaStatus("loading");
      setCaptchaKey((value) => value + 1);
    } finally {
      setSaving(false);
    }
  }

  async function onSync(sourceId?: string) {
    if (syncing) return;
    setSyncing(true);
    try {
      const sources = (cal.data?.sources ?? []).filter(
        (s) => s.enabled && (!sourceId || s.id === sourceId),
      );
      let successes = 0;
      let failures = 0;
      let count = 0;
      for (const source of sources) {
        setActiveSource(source.id);
        setSyncMessage(`Syncing ${source.name}…`);
        const result = await syncCalendars({ data: { sourceId: source.id } });
        for (const outcome of result.outcomes) {
          if (outcome.ok) {
            successes++;
            count += outcome.eventCount ?? 0;
          } else failures++;
        }
        await cal.refetch();
      }
      const message = !sources.length
        ? "No calendars connected. Add one in Settings → Calendars."
        : failures
          ? `${successes} calendars synced; ${failures} failed. Previous events from failed calendars were kept.`
          : `${successes} calendars synced · ${count} events in the import window.`;
      setSyncMessage(message);
      if (failures) toast.error(message);
      else if (sources.length) toast.success(message);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed; retry sync.";
      setSyncMessage(message);
      toast.error(message);
    } finally {
      setSyncing(false);
      setActiveSource(null);
    }
  }

  return (
    <AppShell
      title="Calendar"
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={newEvent}>
            New event
          </Button>
          <Button variant="outline" size="sm" onClick={() => void onSync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
      }
    >
      {cal.isError ? (
        <p role="alert">
          Could not load calendars.{" "}
          <Button variant="outline" onClick={() => void cal.refetch()}>
            Retry
          </Button>
        </p>
      ) : cal.isPending || !cal.data ? (
        <p className="text-sm text-muted-foreground">Loading your week…</p>
      ) : (
        <>
          <Card className="mb-4 space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Connected calendars</h2>
              <Link to="/settings" className="text-sm underline">
                Manage / reconnect
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Imports Google primary and Outlook default calendars, and subscribed feeds: 14 days
              back through 90 days ahead. Other calendars are not imported.
            </p>
            {cal.data.sources.length === 0 && !syncMessage && (
              <p className="text-sm">No calendars connected. Add a calendar in Settings.</p>
            )}
            {cal.data.sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSource === source.id
                      ? "Syncing…"
                      : source.lastSyncedAt
                        ? `Last successful sync: ${new Date(source.lastSyncedAt).toLocaleString()}${source.lastImportedCount == null ? "" : ` · ${source.lastImportedCount} events`}`
                        : "Not synced yet"}
                  </p>
                  {source.lastError && (
                    <p role="alert" className="mt-1 text-sm text-destructive">
                      {source.lastError}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncing || !source.enabled}
                  onClick={() => void onSync(source.id)}
                >
                  {source.lastError ? "Retry" : "Sync"}
                </Button>
              </div>
            ))}
            <p role="status" aria-live="polite" className="text-sm">
              {syncMessage}
            </p>
          </Card>
          <div className="mb-4 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(addDays(cursor, -7))}>
              Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
              This week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(addDays(cursor, 7))}>
              Next
            </Button>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
            {days.map((d) => {
              const key = formatDayKey(d);
              const count = grouped.get(key)?.length ?? 0;
              const isToday = formatDayKey(new Date()) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`day-${key}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "min-w-24 rounded-lg border px-3 py-2 text-left",
                    isToday
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <p className="text-xs opacity-80">{formatDay(d)}</p>
                  <p className="text-sm font-medium tabular-nums">{count} events</p>
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-6">
            {days.map((d) => {
              const key = formatDayKey(d);
              const events = grouped.get(key) ?? [];
              return (
                <section key={key} id={`day-${key}`}>
                  <h2 className="mb-2 font-display text-lg">{formatDay(d)}</h2>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No imported events
                      {cal.data.sources.some((s) => s.lastError)
                        ? " — a calendar failed to sync; retry above."
                        : "."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {events.map((ev) => (
                        <Card
                          key={ev.id}
                          id={`calendar-event-${ev.id}`}
                          className="flex items-start gap-4 p-4"
                        >
                          <div className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
                            {ev.allDay ? "All day" : formatTime(ev.startsAt)}
                            {ev.endsAt && !ev.allDay ? <div>{formatTime(ev.endsAt)}</div> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{ev.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {[ev.location, projectName(ev.projectId)].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge tone={ev.isSample ? "muted" : "primary"}>
                              {ev.sourceProvider}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={
                                !writableSources.some((source) => source.id === ev.sourceId)
                              }
                              title={
                                ev.sourceId ? "Edit event in connected calendar" : "Sample event"
                              }
                              onClick={() => editEvent(ev)}
                            >
                              Edit
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open && !saving) setEditor(null);
        }}
      >
        {editor && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogTitle>
              {editor.eventId ? "Edit calendar event" : "New calendar event"}
            </DialogTitle>
            <DialogDescription>
              Changes are saved directly to the selected calendar.
            </DialogDescription>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-title">Title</Label>
                <Input
                  id="calendar-event-title"
                  autoFocus
                  required
                  maxLength={200}
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-source">Save to</Label>
                <select
                  id="calendar-event-source"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={editor.sourceId}
                  disabled={Boolean(editor.eventId)}
                  onChange={(e) => setEditor({ ...editor, sourceId: e.target.value })}
                >
                  {writableSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.allDay}
                  onChange={(e) => {
                    const allDay = e.target.checked;
                    let endsAt = editor.endsAt;
                    if (allDay && editor.startsAt.slice(0, 10) === editor.endsAt.slice(0, 10)) {
                      const nextDay = new Date(`${editor.startsAt.slice(0, 10)}T00:00:00Z`);
                      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                      endsAt = `${nextDay.toISOString().slice(0, 10)}T00:00`;
                    }
                    setEditor({
                      ...editor,
                      allDay,
                      startsAt: allDay ? `${editor.startsAt.slice(0, 10)}T00:00` : editor.startsAt,
                      endsAt: allDay ? endsAt : editor.endsAt,
                    });
                  }}
                />{" "}
                All day
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="calendar-event-start">Starts</Label>
                  <Input
                    id="calendar-event-start"
                    type={editor.allDay ? "date" : "datetime-local"}
                    value={editor.allDay ? editor.startsAt.slice(0, 10) : editor.startsAt}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        startsAt: editor.allDay ? `${e.target.value}T00:00` : e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calendar-event-end">Ends</Label>
                  <Input
                    id="calendar-event-end"
                    type={editor.allDay ? "date" : "datetime-local"}
                    value={editor.allDay ? editor.endsAt.slice(0, 10) : editor.endsAt}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        endsAt: editor.allDay ? `${e.target.value}T00:00` : e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-location">Location</Label>
                <Input
                  id="calendar-event-location"
                  maxLength={500}
                  value={editor.location}
                  onChange={(e) => setEditor({ ...editor, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-project">Project (optional)</Label>
                <select
                  id="calendar-event-project"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={editor.projectId}
                  onChange={(e) => setEditor({ ...editor, projectId: e.target.value })}
                >
                  <option value="">No project</option>
                  {(ws.data?.projects ?? [])
                    .filter((project) => !project.archived)
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-description">Description</Label>
                <Textarea
                  id="calendar-event-description"
                  maxLength={8000}
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                />
              </div>
              <TurnstileField
                action="calendar-event-write"
                resetKey={captchaKey}
                onToken={setCaptchaToken}
                onStatus={setCaptchaStatus}
              />
              <p className="text-xs text-muted-foreground">
                Times use your device’s local timezone. Subscription (ICS) calendars are read-only.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={saving} onClick={() => setEditor(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    saving || captchaStatus !== "verified" || !captchaToken || !editor.title.trim()
                  }
                  onClick={() => void saveEvent()}
                >
                  {saving ? "Saving…" : "Save event"}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AppShell>
  );
}

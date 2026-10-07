import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

function CalendarPage() {
  const cal = useCalendar();
  const ws = useWorkspace();
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)), [cursor]);

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
        <Button variant="outline" size="sm" onClick={() => void onSync()} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync"}
        </Button>
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
                        <Card key={ev.id} className="flex items-start gap-4 p-4">
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
                          <Badge tone={ev.isSample ? "muted" : "primary"}>
                            {ev.sourceProvider}
                          </Badge>
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
    </AppShell>
  );
}

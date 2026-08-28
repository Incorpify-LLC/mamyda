import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, formatDay, formatDayKey, formatTime, startOfDay } from "@/lib/time";
import { useCalendar } from "@/lib/mamyda/hooks";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { syncCalendars } from "@/lib/mamyda/calendar";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

function CalendarPage() {
  const cal = useCalendar();
  const ws = useWorkspace();
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [syncing, setSyncing] = useState(false);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)),
    [cursor],
  );

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

  const projectName = (id: string | null) =>
    ws.data?.projects.find((p) => p.id === id)?.name;

  async function onSync() {
    setSyncing(true);
    try {
      const result = await syncCalendars();
      if (result.loginUrl) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: result.loginUrl,
        });
        return;
      }
      await cal.refetch();
      toast.success("Calendars refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
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
      {cal.isPending || !cal.data ? (
        <p className="text-sm text-muted-foreground">Loading your week…</p>
      ) : (
      <>
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
                isToday ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
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
                <p className="text-sm text-muted-foreground">Open</p>
              ) : (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <Card key={ev.id} className="flex items-start gap-4 p-4">
                      <div className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {ev.allDay ? "All day" : formatTime(ev.startsAt)}
                        {ev.endsAt && !ev.allDay ? (
                          <div>{formatTime(ev.endsAt)}</div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ev.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {[ev.location, projectName(ev.projectId)]
                            .filter(Boolean)
                            .join(" · ")}
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

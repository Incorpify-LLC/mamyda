import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, colorDot } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts, useCalendar, useNotes, useWorkspace } from "@/lib/mamyda/hooks";
import {
  formatFullDay,
  formatTime,
  greeting,
  sameDay,
  startOfDay,
} from "@/lib/time";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
  const user = useCurrentUser();
  const ws = useWorkspace();
  const cal = useCalendar();
  const notes = useNotes();
  const alerts = useAlerts();
  const now = new Date();

  const todayEvents = useMemo(() => {
    return (cal.data?.events ?? []).filter((e) => sameDay(e.startsAt, now));
  }, [cal.data, now]);

  const due = useMemo(() => {
    const tasks = ws.data?.tasks ?? [];
    const start = startOfDay(now).getTime();
    const end = start + 24 * 3600_000;
    return {
      overdue: tasks.filter(
        (t) => t.dueAt && new Date(t.dueAt).getTime() < start && t.columnId !== "done",
      ),
      today: tasks.filter((t) => {
        if (!t.dueAt || t.columnId === "done") return false;
        const ts = new Date(t.dueAt).getTime();
        return ts >= start && ts < end;
      }),
    };
  }, [ws.data, now]);

  const projectById = useMemo(() => {
    const map = new Map((ws.data?.projects ?? []).map((p) => [p.id, p]));
    return map;
  }, [ws.data]);
  const clientById = useMemo(() => {
    const map = new Map((ws.data?.clients ?? []).map((c) => [c.id, c]));
    return map;
  }, [ws.data]);

  const firstName =
    user?.displayName?.split(" ")[0] ??
    user?.primaryEmail?.split("@")[0] ??
    "there";

  return (
    <AppShell
      title="Today"
      action={
        <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">
          {formatFullDay(now)}
        </span>
      }
    >
      <p className="font-display text-3xl tracking-tight md:text-4xl">
        {greeting()}, {firstName}
      </p>
      <p className="mt-1 text-sm text-muted-foreground md:hidden">
        {formatFullDay(now)} · Asia/Kolkata
      </p>

      {ws.isPending || cal.isPending ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Agenda
              </h2>
              <Link to="/calendar" className="text-sm text-primary underline-offset-4 hover:underline">
                Full calendar
              </Link>
            </div>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing on the books today. Connect Gmail, Outlook, or a Zoho
                feed in Settings.
              </p>
            ) : (
              <ol className="space-y-3">
                {todayEvents.map((ev) => {
                  const project = ev.projectId
                    ? projectById.get(ev.projectId)
                    : undefined;
                  const client = project
                    ? clientById.get(project.clientId)
                    : undefined;
                  return (
                    <li
                      key={ev.id}
                      className="flex gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {ev.allDay ? "All day" : formatTime(ev.startsAt)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[ev.sourceProvider, ev.location, project?.name]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {client && (
                        <span
                          className={`mt-1 size-2.5 shrink-0 rounded-full ${colorDot(client.color)}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Due
            </h2>
            {due.overdue.length === 0 && due.today.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clear. Nothing due today.</p>
            ) : (
              <ul className="space-y-2">
                {due.overdue.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <span className="text-sm">{t.title}</span>
                    <Badge tone="danger">Overdue</Badge>
                  </li>
                ))}
                {due.today.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <span className="text-sm">{t.title}</span>
                    <Badge tone="warn">Today</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/board"
              className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Open board
            </Link>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Alerts
            </h2>
            {(alerts.data?.alerts ?? []).slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Quiet so far. Overdue work, due-soon tasks, and meetings in 30
                minutes land here — and in the email log.
              </p>
            ) : (
              <ul className="space-y-2">
                {(alerts.data?.alerts ?? []).slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Recent notes
              </h2>
              <Link to="/notes" className="text-sm text-primary underline-offset-4 hover:underline">
                All notes
              </Link>
            </div>
            {(notes.data ?? []).slice(0, 3).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Scratch notes tagged with #project-slug attach themselves to a
                project.
              </p>
            ) : (
              <ul className="space-y-3">
                {(notes.data ?? []).slice(0, 3).map((n) => (
                  <li key={n.id}>
                    <p className="font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/minutes">Log minutes</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/notes">New note</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/vault">Open vault</Link>
        </Button>
      </div>
    </AppShell>
  );
}

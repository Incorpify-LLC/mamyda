import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCalendar, useMinutes, useNotes, useWorkspace } from "@/lib/mamyda/hooks";

type SearchHit = { type: string; title: string; detail: string; href: string; text: string };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const workspace = useWorkspace({ enabled: open });
  const calendar = useCalendar({ enabled: open });
  const notes = useNotes({ enabled: open });
  const minutes = useMinutes({ enabled: open });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hits = useMemo(() => {
    const ws = workspace.data;
    if (!ws) return [] as SearchHit[];
    const projects = new Map(ws.projects.map((project) => [project.id, project]));
    const clients = new Map(ws.clients.map((client) => [client.id, client]));
    const result: SearchHit[] = [];
    for (const client of ws.clients)
      result.push({
        type: "Client",
        title: client.name,
        detail: client.email ?? "Client",
        href: `/board?clientId=${encodeURIComponent(client.id)}`,
        text: `${client.name} ${client.email ?? ""} ${client.notes ?? ""}`,
      });
    for (const project of ws.projects)
      result.push({
        type: "Project",
        title: project.name,
        detail: clients.get(project.clientId)?.name ?? "Project",
        href: `/board?clientId=${encodeURIComponent(project.clientId)}&projectId=${encodeURIComponent(project.id)}`,
        text: `${project.name} ${project.slug} ${project.description ?? ""} ${clients.get(project.clientId)?.name ?? ""}`,
      });
    for (const task of ws.tasks) {
      const project = projects.get(task.projectId);
      result.push({
        type: "Task",
        title: task.title,
        detail: `${clients.get(project?.clientId ?? "")?.name ?? ""} · ${project?.name ?? ""}`,
        href: `/board?clientId=${encodeURIComponent(project?.clientId ?? "")}&projectId=${encodeURIComponent(task.projectId)}&taskId=${encodeURIComponent(task.id)}`,
        text: `${task.title} ${task.notes ?? ""} ${task.labels.join(" ")} ${project?.name ?? ""} ${clients.get(project?.clientId ?? "")?.name ?? ""}`,
      });
    }
    for (const note of notes.data ?? [])
      result.push({
        type: "Note",
        title: note.title || note.body.slice(0, 70) || "Untitled note",
        detail: note.projectId ? (projects.get(note.projectId)?.name ?? "Note") : "Note",
        href: `/notes?noteId=${encodeURIComponent(note.id)}`,
        text: `${note.title} ${note.body} ${note.tags.join(" ")}`,
      });
    for (const minute of minutes.data ?? [])
      result.push({
        type: "Minutes",
        title: minute.title || "Untitled minutes",
        detail: minute.projectId ? (projects.get(minute.projectId)?.name ?? "Meeting") : "Meeting",
        href: `/minutes?minuteId=${encodeURIComponent(minute.id)}`,
        text: `${minute.title} ${minute.body} ${minute.attendees}`,
      });
    for (const event of calendar.data?.events ?? [])
      result.push({
        type: "Calendar",
        title: event.title,
        detail: `${new Date(event.startsAt).toLocaleDateString()} · ${event.sourceProvider}`,
        href: `/calendar?eventId=${encodeURIComponent(event.id)}`,
        text: `${event.title} ${event.description ?? ""} ${event.location ?? ""} ${event.attendees.join(" ")}`,
      });
    return result;
  }, [workspace.data, notes.data, minutes.data, calendar.data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return hits
      .filter((hit) =>
        `${hit.title} ${hit.detail} ${hit.text}`.toLocaleLowerCase().includes(needle),
      )
      .sort((a, b) => {
        const score = (hit: SearchHit) => {
          const title = hit.title.toLocaleLowerCase();
          if (title === needle) return 0;
          if (title.startsWith(needle)) return 1;
          if (title.includes(needle)) return 2;
          if (hit.detail.toLocaleLowerCase().includes(needle)) return 3;
          return 4;
        };
        return score(a) - score(b);
      })
      .slice(0, 40);
  }, [hits, query]);

  useEffect(() => setSelected(0), [query]);
  const loading = workspace.isPending || notes.isPending || minutes.isPending || calendar.isPending;
  function openHit(hit: SearchHit) {
    setOpen(false);
    window.location.assign(hit.href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Search workspace"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-1 size-4" aria-hidden="true" /> Search{" "}
        <kbd className="ml-2 hidden rounded border px-1 text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-hidden p-0">
          <div className="border-b p-4 pr-12">
            <DialogTitle>Search your workspace</DialogTitle>
            <DialogDescription>
              Find clients, projects, tasks, notes, minutes, and calendar events.
            </DialogDescription>
            <Input
              autoFocus
              className="mt-3"
              aria-label="Search all workspace records"
              placeholder="Type at least 2 characters…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelected((current) => Math.min(current + 1, filtered.length - 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelected((current) => Math.max(0, current - 1));
                }
                if (event.key === "Enter" && filtered[selected]) {
                  event.preventDefault();
                  openHit(filtered[selected]!);
                }
              }}
            />
          </div>
          <div
            className="max-h-[55dvh] overflow-y-auto p-2"
            role="listbox"
            aria-label="Search results"
          >
            {query.trim().length < 2 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Enter at least two characters to search.
              </p>
            ) : loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading workspace records…</p>
            ) : !filtered.length ? (
              <p className="p-4 text-sm text-muted-foreground">No matching records.</p>
            ) : (
              filtered.map((hit, index) => (
                <button
                  key={`${hit.type}-${hit.href}`}
                  type="button"
                  role="option"
                  aria-selected={selected === index}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => openHit(hit)}
                  className={`mb-1 flex w-full items-start gap-3 rounded-lg p-3 text-left ${selected === index ? "bg-muted" : "hover:bg-muted/60"}`}
                >
                  <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                    {hit.type}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{hit.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {hit.detail}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Searches only records in your signed-in workspace.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { boardSearchContext, isBoardPath } from "@/lib/board-navigation";
import { useBoardMemory } from "@/components/board-context-memory";
import { resolveProjectContext, type ProjectSearch } from "@/lib/project-context";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { Label } from "@/components/ui/label";

export function useProjectContext(
  defaultProject = false,
  assetProjectId?: string | null,
  sync = true,
) {
  const ws = useWorkspace();
  const location = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  const { remember, search: remembered, ready } = useBoardMemory();
  const requested = boardSearchContext(location.search);
  // A direct asset link must not open under an unrelated default project.
  const search = assetProjectId
    ? { projectId: assetProjectId }
    : Object.keys(requested).length
      ? requested
      : remembered;
  const result = resolveProjectContext(
    ws.data?.clients ?? [],
    ws.data?.projects ?? [],
    search,
    defaultProject,
  );
  const clientId = result.search.clientId;
  const projectId = result.search.projectId;
  useEffect(() => {
    if (ready && sync && ws.data && !result.invalid && isBoardPath(location.pathname))
      remember({ ...(clientId ? { clientId } : {}), ...(projectId ? { projectId } : {}) });
  }, [ready, sync, ws.data, result.invalid, location.pathname, clientId, projectId, remember]);
  useEffect(() => {
    if (!ready || !sync || !ws.data || result.invalid) return;
    if (
      (requested.clientId || undefined) === clientId &&
      (requested.projectId || undefined) === projectId
    )
      return;
    void navigate({
      to: location.pathname,
      search: { ...location.search, clientId, projectId },
      replace: true,
    });
  }, [
    ws.data,
    result.invalid,
    requested.clientId,
    requested.projectId,
    clientId,
    projectId,
    location.pathname,
    location.search,
    navigate,
    sync,
    ready,
  ]);
  function select(next: ProjectSearch) {
    // Remove record IDs when changing scope; routing blockers protect editor drafts.
    void navigate({ to: location.pathname, search: { clientId: "", projectId: "", ...next } });
  }
  return {
    ...result,
    select,
    loading: ws.isPending || !ready,
    error: ws.isError,
    retry: ws.refetch,
  };
}

export function ProjectContextPicker({ disabled = false }: { disabled?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const context = useProjectContext(false, undefined, false);
  return (
    <section aria-label="Current project" className="mb-5 min-w-0 border-b border-border pb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground sr-only">
        Board context ·{" "}
        {context.loading
          ? "Loading projects…"
          : (context.project?.name ?? context.client?.name ?? "All projects")}
      </p>
      {context.invalid && !context.loading && !context.error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          This client or project is unavailable or archived. Choose an active project below; no
          replacement was selected.
        </p>
      )}
      {context.error && (
        <p role="alert">
          Could not load projects.{" "}
          <button type="button" className="underline" onClick={() => void context.retry()}>
            Retry
          </button>
        </p>
      )}
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <Label className="min-w-0 space-y-1">
          Client
          <select
            aria-label="Select client"
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
            disabled={disabled || context.loading || context.error}
            value={context.client?.id ?? ""}
            onChange={(e) => {
              const clientId = e.target.value;
              const project = context.projects.find((item) => item.clientId === clientId);
              context.select(
                clientId ? { clientId, ...(project ? { projectId: project.id } : {}) } : {},
              );
            }}
          >
            <option value="">
              {pathname === "/board" || pathname === "/files" ? "Choose client" : "All clients"}
            </option>
            {context.clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Label>
        <Label className="min-w-0 space-y-1">
          Project
          <select
            aria-label="Select project"
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
            disabled={disabled || context.loading || context.error}
            value={context.project?.id ?? ""}
            onChange={(e) =>
              context.select({
                ...(context.client ? { clientId: context.client.id } : {}),
                ...(e.target.value ? { projectId: e.target.value } : {}),
              })
            }
          >
            <option value="">
              {pathname === "/board" || pathname === "/files" ? "Choose project" : "All projects"}
            </option>
            {context.projects
              .filter((item) => !context.client || item.clientId === context.client.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </Label>
      </div>
    </section>
  );
}

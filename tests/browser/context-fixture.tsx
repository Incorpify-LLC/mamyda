// Real shell/context/preferences with an isolated read-only workspace.
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useProjectContext } from "@/components/project-context";
import { PersonalPreferencesPanel } from "@/components/personal-preferences";
import { BoardContextMemory } from "@/components/board-context-memory";
import { boardSearchContext, isBoardPath } from "@/lib/board-navigation";
import "@/styles.css";

function Page() {
  const location = useRouterState({ select: (s) => s.location });
  const router = useRouter();
  const context = useProjectContext(
    location.pathname === "/board" || location.pathname === "/files",
  );
  return (
    <AppShell
      title={location.pathname === "/preferences" ? "Preferences" : "Board"}
      boardContext={isBoardPath(location.pathname) ? context.search : undefined}
    >
      <button type="button" onClick={() => router.history.back()}>
        Go back
      </button>
      <p role="status" aria-label="Resolved context">
        {location.pathname} · {context.client?.id ?? "all"} / {context.project?.id ?? "all"}
      </p>
      <p data-testid="location">{location.href}</p>
      {location.pathname === "/preferences" && <PersonalPreferencesPanel />}
    </AppShell>
  );
}
const root = createRootRoute({
  component: () => (
    <BoardContextMemory>
      <Outlet />
    </BoardContextMemory>
  ),
});
const paths = [
  "/",
  "/board",
  "/minutes",
  "/notes",
  "/files",
  "/vault",
  "/calendar",
  "/clients",
  "/chat",
  "/settings",
  "/preferences",
];
const routes = paths.map((path) =>
  createRoute({
    getParentRoute: () => root,
    path,
    validateSearch: boardSearchContext,
    component: Page,
  }),
);
const entry = new URLSearchParams(window.location.search).get("entry") ?? "/board";
const router = createRouter({
  routeTree: root.addChildren(routes),
  history: createMemoryHistory({ initialEntries: [entry] }),
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

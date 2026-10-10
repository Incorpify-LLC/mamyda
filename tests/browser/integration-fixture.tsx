import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route as SettingsRoute } from "@/routes/_app/settings";
import { Route as CalendarRoute } from "@/routes/_app/calendar";
import { SubmissionVerificationProvider } from "@/components/submission-verification";
import "@/styles.css";
const root = createRootRoute({ component: Outlet });
const app = createRoute({ getParentRoute: () => root, id: "_app", component: Outlet });
const settings = createRoute({
  getParentRoute: () => app,
  path: "settings",
  component: SettingsRoute.options.component,
});
const calendar = createRoute({
  getParentRoute: () => app,
  path: "calendar",
  component: CalendarRoute.options.component,
  validateSearch: CalendarRoute.options.validateSearch,
});
const router = createRouter({
  routeTree: root.addChildren([app.addChildren([settings, calendar])]),
  history: createMemoryHistory({
    initialEntries: [
      new URLSearchParams(window.location.search).has("calendar") ? "/calendar" : "/settings",
    ],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <SubmissionVerificationProvider>
      <RouterProvider router={router} />
    </SubmissionVerificationProvider>
  </QueryClientProvider>,
);

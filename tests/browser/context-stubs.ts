// Isolated read-only workspace data. No customer data or network writes.
import { useIntegrationWorkspace } from "./integration-stubs";
export { useCalendar, useAlerts } from "./integration-stubs";
export function useWorkspace() {
  if (document.title === "Isolated integration UI") return useIntegrationWorkspace();
  return {
    data: {
      clients: [
        { id: "a", name: "Alpha client", archived: false },
        { id: "b", name: "Beta client", archived: false },
      ],
      projects: [
        { id: "p", clientId: "a", name: "Alpha project", archived: false },
        { id: "q", clientId: "b", name: "Beta project", archived: false },
        { id: "x", clientId: "a", name: "Archived project", archived: true },
      ],
    },
    isPending: false,
    isError: false,
    refetch: async () => {},
  };
}

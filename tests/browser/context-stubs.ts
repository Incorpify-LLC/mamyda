// Isolated read-only workspace data. No customer data or network writes.
export function useWorkspace() {
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

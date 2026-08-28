import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspace, seedWorkspace } from "./workspace";
import { listCalendar } from "./calendar";
import { listAlerts, runAlerts } from "./alerts";
import { listMinutes, listNotes, listVault } from "./writing";

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const ws = await getWorkspace();
      if (!ws.profile.seededAt) return seedWorkspace();
      return ws;
    },
  });
}

export function useCalendar() {
  const ws = useWorkspace();
  return useQuery({
    queryKey: ["calendar"],
    enabled: Boolean(ws.data?.profile.seededAt),
    queryFn: () => listCalendar(),
  });
}

export function useMinutes() {
  const ws = useWorkspace();
  return useQuery({
    queryKey: ["minutes"],
    enabled: Boolean(ws.data?.profile.seededAt),
    queryFn: () => listMinutes(),
  });
}

export function useNotes() {
  const ws = useWorkspace();
  return useQuery({
    queryKey: ["notes"],
    enabled: Boolean(ws.data?.profile.seededAt),
    queryFn: () => listNotes(),
  });
}

export function useVaultList() {
  return useQuery({
    queryKey: ["vault"],
    queryFn: () => listVault(),
  });
}

export function useAlerts() {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["alerts"],
    enabled: Boolean(ws.data?.profile.seededAt),
    queryFn: async () => {
      try {
        await runAlerts();
      } catch {
        /* still list */
      }
      return listAlerts();
    },
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  return { ...query, invalidate };
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["workspace"] });
    void qc.invalidateQueries({ queryKey: ["calendar"] });
    void qc.invalidateQueries({ queryKey: ["minutes"] });
    void qc.invalidateQueries({ queryKey: ["notes"] });
    void qc.invalidateQueries({ queryKey: ["vault"] });
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };
}

export { useMutation, useQueryClient };

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspace } from "./workspace";
import { listCalendar } from "./calendar";
import { listAlerts, runAlerts } from "./alerts";
import { listMinutes, listNotes, listVault } from "./writing";

export function useWorkspace(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: () => getWorkspace(),
    enabled: options.enabled ?? true,
  });
}

export function useCalendar(options: { enabled?: boolean } = {}) {
  const ws = useWorkspace(options);
  return useQuery({
    queryKey: ["calendar"],
    enabled: ws.isSuccess && (options.enabled ?? true),
    queryFn: () => listCalendar(),
  });
}

export function useMinutes(options: { enabled?: boolean } = {}) {
  const ws = useWorkspace(options);
  return useQuery({
    queryKey: ["minutes"],
    enabled: ws.isSuccess && (options.enabled ?? true),
    queryFn: () => listMinutes(),
  });
}

export function useNotes(options: { enabled?: boolean } = {}) {
  const ws = useWorkspace(options);
  return useQuery({
    queryKey: ["notes"],
    enabled: ws.isSuccess && (options.enabled ?? true),
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
    enabled: ws.isSuccess,
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

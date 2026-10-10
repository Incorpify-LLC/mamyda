// Isolated integration UI: no credentials, provider traffic or outbound notifications.
import { useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import type { CalendarSource } from "@/lib/mamyda/types";

const fixtureScenario = new URLSearchParams(window.location.search).get("state");
const scenario = () => fixtureScenario;
const sources: CalendarSource[] = [
  {
    id: "g",
    provider: "google",
    name: "Google Calendar",
    accountEmail: "alice@example.test",
    connected: true,
    enabled: true,
    icsUrl: null,
    lastSyncedAt: "2026-10-10T00:00:00Z",
    lastImportedCount: 2,
    lastError: null,
  },
  {
    id: "o",
    provider: "outlook",
    name: "Outlook Calendar",
    accountEmail: "alice@outlook.test",
    connected: true,
    enabled: true,
    icsUrl: null,
    lastSyncedAt: null,
    lastError: null,
  },
];
const qa = {
  reads: 0,
  syncs: [] as string[],
  mutations: [] as string[],
  sources,
  events: [
    {
      id: "fixture-event",
      sourceId: "g",
      sourceProvider: "google",
      externalId: "fixture",
      title:
        "A long calendar title that should wrap on small screens without squeezing the time and action controls",
      description: "",
      location: "Fixture project meeting",
      startsAt: new Date().toISOString(),
      endsAt: null,
      allDay: false,
      attendees: [],
      projectId: null,
      isSample: false,
    },
  ],
};
(window as unknown as { __integrationQA: typeof qa }).__integrationQA = qa;
if (scenario() === "disconnected") sources[0].connected = false;
if (scenario() === "disabled") sources[0].enabled = false;
if (scenario() === "empty") sources.length = 0;
if (scenario() === "empty") qa.events.length = 0;

export function useIntegrationWorkspace() {
  return {
    data: {
      profile: {
        alertEmail: "alice@example.test",
        telegramLinked: true,
        alertsEmailEnabled: true,
        alertsTelegramEnabled: false,
        alertsDueSoon: true,
        alertsOverdue: true,
        alertsMeeting: true,
      },
      clients: [],
      projects: [],
      tasks: [],
    },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: async () => {},
  };
}
export function useCalendar() {
  return useQuery({
    queryKey: ["fixture-calendar"],
    queryFn: async () => {
      if (scenario() === "loading") return new Promise<never>(() => {});
      if (scenario() === "error") throw new Error("Fixture calendar unavailable");
      return { sources: qa.sources.map((source) => ({ ...source })), events: qa.events };
    },
    retry: false,
  });
}
export function useAlerts(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["fixture-alerts"],
    enabled: options.enabled ?? true,
    queryFn: async () => {
      qa.reads++;
      if (scenario() === "logs-loading") return new Promise<never>(() => {});
      if (scenario() === "logs-error") throw new Error("Fixture log unavailable");
      return { alerts: [], emails: [] };
    },
    retry: false,
  });
}
export async function syncCalendars({ data }: { data: { sourceId: string } }) {
  qa.syncs.push(data.sourceId);
  const source = qa.sources.find((item) => item.id === data.sourceId)!;
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (scenario() === "network-error" && source.id === "g")
    throw new Error("Fixture sync request unavailable");
  if (scenario() === "sync-error" && source.id === "g") {
    source.lastError = "Authorization expired";
    return { outcomes: [{ sourceId: source.id, ok: false, error: source.lastError }] };
  }
  source.lastError = null;
  source.lastSyncedAt = new Date().toISOString();
  source.lastImportedCount = 0;
  if (source.id === "g") qa.events.length = 0;
  return { outcomes: [{ sourceId: source.id, ok: true, eventCount: 0 }] };
}
const disabled = async () => {
  qa.mutations.push("blocked mutation");
  throw new Error("Writes are disabled in this fixture");
};
export const addIcsSource = disabled;
export const connectProvider = disabled;
export const removeSource = disabled;
export const sendTestNotification = disabled;
export const beginTelegramLink = disabled;
export const createCalendarEvent = disabled;
export const updateCalendarEvent = disabled;
export function LLMSettingsPanel() {
  return createElement("p", null, "Fixture LLM configuration — no model calls.");
}

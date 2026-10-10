import type { CalendarSource } from "@/lib/mamyda/types";

export function calendarConnectionState(source: CalendarSource) {
  if (!source.enabled) return "Disabled";
  if (source.connected === false) return "Not connected";
  if (source.lastError) return "Sync failed";
  return "Connected";
}

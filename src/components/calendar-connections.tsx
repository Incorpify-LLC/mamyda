import { Badge } from "@/components/ui/badge";
import type { CalendarSource } from "@/lib/mamyda/types";
import { APP_TZ, formatDay, formatTime } from "@/lib/time";

import { calendarConnectionState } from "@/lib/calendar-status";

export function CalendarSourceSummary({
  source,
  syncing = false,
}: {
  source: CalendarSource;
  syncing?: boolean;
}) {
  const provider = source.icsUrl
    ? "Read-only subscription"
    : source.provider === "outlook"
      ? "Microsoft · default calendar"
      : "Google · primary calendar";
  return (
    <div
      role="group"
      aria-label={`${source.name} connection`}
      className="min-w-0 flex-1 space-y-1 break-words"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{source.name}</p>
        <Badge>{syncing ? "Syncing…" : calendarConnectionState(source)}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{provider}</p>
      {!source.icsUrl && (
        <p className="text-sm">
          {source.accountEmail ?? "Account identity unavailable — reconnect to refresh it."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {source.lastSyncedAt
          ? `Last successful sync: ${formatDay(source.lastSyncedAt)} ${formatTime(source.lastSyncedAt)} · ${APP_TZ}${source.lastImportedCount == null ? "" : ` · ${source.lastImportedCount} events`}`
          : "Not synced yet"}
      </p>
      {source.connected === false && (
        <p className="text-sm text-destructive">
          Reconnect in Settings to authorize this calendar.
        </p>
      )}
      {source.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {source.lastError} Previous events are kept. Retry sync; if authorization expired,
          reconnect in Settings.
        </p>
      )}
    </div>
  );
}

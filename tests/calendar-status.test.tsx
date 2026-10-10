import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarSourceSummary } from "@/components/calendar-connections";
import { calendarConnectionState } from "@/lib/calendar-status";
import type { CalendarSource } from "@/lib/mamyda/types";

const source: CalendarSource = {
  id: "g",
  provider: "google",
  name: "Google Calendar",
  icsUrl: null,
  enabled: true,
  connected: true,
  accountEmail: "alice@example.test",
  lastSyncedAt: "2026-10-10T00:00:00Z",
  lastImportedCount: 0,
  lastError: null,
};
test("connected identity, empty successful sync and explicit timezone are visible", () => {
  const markup = renderToStaticMarkup(<CalendarSourceSummary source={source} />);
  expect(markup).toContain("alice@example.test");
  expect(markup).toContain("Connected");
  expect(markup).toContain("0 events");
  expect(markup).toContain("Asia/Kolkata");
  expect(markup).toContain("5:30");
});
test("missing authorization and sync failures cannot look healthy", () => {
  expect(calendarConnectionState({ ...source, connected: false })).toBe("Not connected");
  expect(calendarConnectionState({ ...source, lastError: "Authorization expired" })).toBe(
    "Sync failed",
  );
  expect(calendarConnectionState({ ...source, enabled: false })).toBe("Disabled");
  const markup = renderToStaticMarkup(
    <CalendarSourceSummary source={{ ...source, lastError: "Authorization expired" }} />,
  );
  expect(markup).toContain("Previous events are kept");
  expect(markup).toContain("reconnect");
});
test("subscription credentials are not shown in the connection summary", () => {
  const markup = renderToStaticMarkup(
    <CalendarSourceSummary
      source={{
        ...source,
        provider: "zoho",
        icsUrl: "https://example.test/private-secret.ics",
        accountEmail: null,
        lastSyncedAt: null,
      }}
    />,
  );
  expect(markup).toContain("Read-only subscription");
  expect(markup).toContain("Not synced yet");
  expect(markup).not.toContain("private-secret");
});

import { describe, expect, it, vi } from "vitest";
import {
  providerEventBody,
  sendProviderEvent,
  type CalendarEventWrite,
} from "../src/lib/mamyda/calendar-oauth.server";

const timed: CalendarEventWrite = {
  title: "Planning",
  description: "Quarterly review",
  location: "Room 4",
  startsAt: "2026-10-07T09:00:00.000Z",
  endsAt: "2026-10-07T10:00:00.000Z",
  allDay: false,
};

describe("calendar provider event writes", () => {
  it("maps timed events to Google Calendar fields", () => {
    expect(providerEventBody("google", timed)).toEqual({
      summary: "Planning",
      description: "Quarterly review",
      location: "Room 4",
      start: { dateTime: timed.startsAt },
      end: { dateTime: timed.endsAt },
    });
  });

  it("maps all-day events to exclusive date ranges and Microsoft UTC fields", () => {
    const allDay = { ...timed, startsAt: "2026-10-07", endsAt: "2026-10-08", allDay: true };
    expect(providerEventBody("google", allDay).start).toEqual({ date: "2026-10-07" });
    expect(providerEventBody("google", allDay).end).toEqual({ date: "2026-10-08" });
    expect(providerEventBody("outlook", allDay)).toMatchObject({
      isAllDay: true,
      start: { dateTime: "2026-10-07T00:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-10-08T00:00:00", timeZone: "UTC" },
    });
  });

  it("uses POST for create and PATCH for update, returning the provider identifier", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ id: "provider-event-id" }), { status: 200 }),
    );
    await sendProviderEvent("google", "token", timed, undefined, fetcher as typeof fetch);
    await sendProviderEvent("outlook", "token", timed, "existing/id", fetcher as typeof fetch);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("existing%2Fid");
  });

  it("explains revoked/insufficient provider authorization and rejects invalid ranges", async () => {
    const denied = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(
      sendProviderEvent("google", "token", timed, undefined, denied as typeof fetch),
    ).rejects.toThrow("Reconnect it in Settings");
    expect(() => providerEventBody("google", { ...timed, endsAt: timed.startsAt })).toThrow(
      "end time after",
    );
  });
});

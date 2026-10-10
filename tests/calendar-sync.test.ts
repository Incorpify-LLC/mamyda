import { beforeAll, afterAll, beforeEach, expect, test, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { reconcileEvents, type ImportedEvent } from "@/lib/mamyda/calendar-reconcile.server";
import { fetchCalendarPages } from "@/lib/mamyda/calendar-pages.server";
import type { Sql } from "@/lib/db";

const state = vi.hoisted(() => ({ sql: undefined as unknown as Sql, oauth: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: any) => value;
    const chain = {
      middleware: () => chain,
      validator: (fn: typeof validate) => {
        validate = fn;
        return chain;
      },
      handler:
        (fn: any) =>
        (input: any = {}) =>
          fn({ context: { userId: "alice" }, data: validate(input.data) }),
    };
    return chain;
  },
}));
vi.mock("@/lib/auth/middleware", () => ({ authMiddleware: {} }));
vi.mock("@/lib/db", () => ({ getSql: async () => state.sql }));
vi.mock("@/lib/mamyda/calendar-oauth.server", () => ({
  listOAuthEvents: state.oauth,
  beginCalendarOAuth: vi.fn(),
}));
vi.mock("@/lib/mamyda/turnstile.server", () => ({ requireTurnstile: vi.fn() }));
import { syncCalendars, listCalendar } from "@/lib/mamyda/calendar";

let db: PGlite;
const event: ImportedEvent = {
  externalId: "meeting-1",
  title: "Meeting",
  description: "",
  location: "",
  startsAt: new Date().toISOString(),
  endsAt: null,
  allDay: false,
  attendees: [],
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("migrations/0002_mamyda.sql", "utf8"));
  await db.exec(readFileSync("migrations/0004_calendar_oauth.sql", "utf8"));
  await db.exec(readFileSync("migrations/0005_calendar_sync.sql", "utf8"));
  state.sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        args,
      )
    ).rows) as Sql;
  state.sql.query = async <T>(query: string, args: unknown[] = []) =>
    (await db.query<T>(query, args)).rows;
});
afterAll(async () => db.close());
beforeEach(async () => {
  state.oauth.mockReset();
  await db.exec(
    "TRUNCATE calendar_events,calendar_sources,calendar_oauth_connections,minutes; INSERT INTO calendar_sources(id,user_id,provider,name) VALUES ('g','alice','google','Google'),('o','alice','outlook','Outlook'),('b','bob','google','Private')",
  );
});
test("calendar reads expose only the signed-in account identity, never OAuth credentials", async () => {
  await db.exec(`INSERT INTO calendar_oauth_connections(user_id,provider,access_token_cipher,refresh_token_cipher,expires_at,account_email)
    VALUES ('alice','google','access-secret','refresh-secret',now(),'alice@example.test'),
      ('bob','google','other-secret','other-refresh',now(),'bob@example.test');`);
  const result = await listCalendar();
  expect(result.sources.find((source) => source.id === "g")).toMatchObject({
    accountEmail: "alice@example.test",
    connected: true,
  });
  expect(result.sources.find((source) => source.id === "o")).toMatchObject({
    accountEmail: null,
    connected: false,
  });
  expect(JSON.stringify(result)).not.toMatch(/bob@example|secret|refresh/);
  expect(state.oauth).not.toHaveBeenCalled();
});
test("repeated sync retains event IDs, project links and minutes", async () => {
  await reconcileEvents(state.sql, "alice", "g", "google", [event]);
  const id = (await db.query<any>("SELECT id FROM calendar_events")).rows[0].id;
  await db.query("UPDATE calendar_events SET project_id='project' WHERE id=$1", [id]);
  await db.query(
    "INSERT INTO minutes(id,user_id,title,event_id) VALUES ('m','alice','Minutes',$1)",
    [id],
  );
  await reconcileEvents(state.sql, "alice", "g", "google", [{ ...event, title: "Updated" }]);
  const rows = (await db.query<any>("SELECT * FROM calendar_events")).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id, title: "Updated", project_id: "project" });
  expect((await db.query<any>("SELECT event_id FROM minutes")).rows[0].event_id).toBe(id);
});
test("removed events remain linkable but disappear from the calendar; returning events reuse IDs", async () => {
  await reconcileEvents(state.sql, "alice", "g", "google", [event]);
  const id = (await db.query<any>("SELECT id FROM calendar_events")).rows[0].id;
  await reconcileEvents(state.sql, "alice", "g", "google", []);
  expect((await listCalendar()).events).toHaveLength(0);
  expect(
    (await db.query<any>("SELECT removed_at FROM calendar_events")).rows[0].removed_at,
  ).not.toBeNull();
  await reconcileEvents(state.sql, "alice", "g", "google", [event]);
  expect((await listCalendar()).events[0].id).toBe(id);
});
test("invalid import is atomic and keeps the last successful snapshot", async () => {
  await reconcileEvents(state.sql, "alice", "g", "google", [event]);
  await expect(
    reconcileEvents(state.sql, "alice", "g", "google", [
      { ...event, externalId: "bad", startsAt: "invalid" },
    ]),
  ).rejects.toThrow();
  expect((await listCalendar()).events[0].externalId).toBe(event.externalId);
});
test("partial failure reports each source, retaining failed-source events", async () => {
  await reconcileEvents(state.sql, "alice", "g", "google", [event]);
  state.oauth.mockImplementation(async (_user, source) => {
    if (source.id === "g") throw new Error("Authorization expired; reconnect");
    return [];
  });
  const result = await syncCalendars();
  expect(result.outcomes).toHaveLength(2);
  expect(result.outcomes.find((o: any) => o.sourceId === "g")).toMatchObject({
    ok: false,
    error: expect.stringContaining("reconnect"),
  });
  expect(result.outcomes.find((o: any) => o.sourceId === "o")).toMatchObject({
    ok: true,
    eventCount: 0,
  });
  expect((await listCalendar()).events).toHaveLength(1);
});
test("single-source retry cannot touch another account", async () => {
  expect((await syncCalendars({ data: { sourceId: "b" } })).outcomes).toEqual([]);
  expect(state.oauth).not.toHaveBeenCalled();
});
test("Outlook offsetless UTC timestamps and all-day flags normalize correctly", async () => {
  state.oauth.mockResolvedValue([
    {
      id: "utc",
      subject: "All day",
      isAllDay: true,
      start: { dateTime: "2026-10-07T00:00:00.0000000" },
      end: { dateTime: "2026-10-08T00:00:00.0000000" },
    },
  ]);
  await syncCalendars({ data: { sourceId: "o" } });
  const saved = (await db.query<any>("SELECT * FROM calendar_events")).rows[0];
  expect(saved.starts_at.toISOString()).toBe("2026-10-07T00:00:00.000Z");
  expect(saved.all_day).toBe(true);
});
test("Google pagination imports more than 250 events, including empty intermediate pages", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        items: Array.from({ length: 250 }, (_, id) => ({ id })),
        nextPageToken: "two",
      }),
    )
    .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: "three" }))
    .mockResolvedValueOnce(Response.json({ items: [{ id: 251 }] }));
  expect(
    await fetchCalendarPages(
      "google",
      new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250"),
      "secret",
      fetcher,
    ),
  ).toHaveLength(251);
  expect(fetcher.mock.calls[2][0].searchParams.get("pageToken")).toBe("three");
});
test("Outlook follows nextLink and never leaks tokens to another host", async () => {
  const initial = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ value: [1], "@odata.nextLink": initial + "?skip=1" }))
    .mockResolvedValueOnce(Response.json({ value: [2] }));
  expect(await fetchCalendarPages("outlook", initial, "secret", fetcher)).toEqual([1, 2]);
  const unsafe = vi
    .fn()
    .mockResolvedValue(
      Response.json({ value: [], "@odata.nextLink": "https://evil.example/steal" }),
    );
  await expect(fetchCalendarPages("outlook", initial, "secret", unsafe)).rejects.toThrow(
    "pagination",
  );
  expect(unsafe).toHaveBeenCalledTimes(1);
});
test.each([401, 403, 500])(
  "provider error %s is actionable and never reported as an empty calendar",
  async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response("error", { status }));
    await expect(
      fetchCalendarPages(
        "google",
        new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events"),
        "secret",
        fetcher,
      ),
    ).rejects.toThrow(status === 500 ? "retry" : "reconnect");
  },
);
test("second-page failure discards the incomplete fetch", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ items: [1], nextPageToken: "two" }))
    .mockResolvedValueOnce(new Response("failure", { status: 503 }));
  await expect(
    fetchCalendarPages(
      "google",
      new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events"),
      "secret",
      fetcher,
    ),
  ).rejects.toThrow("Previous events were kept");
});

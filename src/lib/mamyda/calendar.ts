import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ConnectorType } from "@/lib/app-data";
import { parseIcs } from "@/lib/ics";
import { nid } from "@/lib/utils";
import { addDays, iso, startOfDay } from "@/lib/time";
import { mapEvent, mapSource } from "./map";
import type { CalendarSource } from "./types";

type ConnectorEvent = {
  id?: string;
  iCalUID?: string;
  summary?: string;
  title?: string;
  subject?: string;
  description?: string;
  bodyPreview?: string;
  location?: string | { displayName?: string };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  startTime?: string;
  endTime?: string;
  attendees?: Array<{ email?: string; emailAddress?: { address?: string } }>;
};

function asList(data: unknown): ConnectorEvent[] {
  if (Array.isArray(data)) return data as ConnectorEvent[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["events", "items", "value", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as ConnectorEvent[];
    }
  }
  return [];
}

function normalizeConnector(
  ev: ConnectorEvent,
  provider: string,
): {
  externalId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  attendees: string[];
} | null {
  const startRaw = ev.start?.dateTime ?? ev.start?.date ?? ev.startTime;
  if (!startRaw) return null;
  const endRaw = ev.end?.dateTime ?? ev.end?.date ?? ev.endTime ?? null;
  const allDay = Boolean(ev.start?.date && !ev.start.dateTime);
  const loc =
    typeof ev.location === "string"
      ? ev.location
      : (ev.location?.displayName ?? "");
  const attendees = (ev.attendees ?? [])
    .map((a) => a.email ?? a.emailAddress?.address ?? "")
    .filter(Boolean);
  return {
    externalId: String(ev.id ?? ev.iCalUID ?? `${provider}-${startRaw}`),
    title: ev.summary ?? ev.title ?? ev.subject ?? "(No title)",
    description: ev.description ?? ev.bodyPreview ?? "",
    location: loc,
    startsAt: new Date(startRaw).toISOString(),
    endsAt: endRaw ? new Date(endRaw).toISOString() : null,
    allDay,
    attendees,
  };
}

async function replaceSourceEvents(
  userId: string,
  sourceId: string,
  provider: string,
  events: ReturnType<typeof normalizeConnector>[],
) {
  const sql = await getSql();
  await sql`
    delete from calendar_events
    where user_id = ${userId} and source_id = ${sourceId} and is_sample = false
  `;
  for (const ev of events) {
    if (!ev) continue;
    await sql`
      insert into calendar_events (
        id, user_id, source_id, source_provider, external_id, title, description,
        location, starts_at, ends_at, all_day, attendees, is_sample
      ) values (
        ${nid()}, ${userId}, ${sourceId}, ${provider}, ${ev.externalId}, ${ev.title},
        ${ev.description || null}, ${ev.location || null}, ${ev.startsAt}, ${ev.endsAt},
        ${ev.allDay}, ${JSON.stringify(ev.attendees)}, false
      )
    `;
  }
}

async function syncIcsSource(userId: string, source: CalendarSource) {
  const sql = await getSql();
  if (!source.icsUrl) throw new Error("Missing calendar URL");
  const res = await fetch(source.icsUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
  const text = await res.text();
  const parsed = parseIcs(text);
  const windowStart = addDays(startOfDay(new Date()), -14).getTime();
  const windowEnd = addDays(startOfDay(new Date()), 90).getTime();
  const events = parsed
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t >= windowStart && t <= windowEnd;
    })
    .map((e) => ({
      externalId: e.uid,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      attendees: e.attendees,
    }));
  await replaceSourceEvents(userId, source.id, source.provider, events);
  await sql`
    update calendar_sources
    set last_synced_at = now(), last_error = null
    where id = ${source.id} and user_id = ${userId}
  `;
}

async function syncConnector(
  userId: string,
  source: CalendarSource,
  connectorType: (typeof ConnectorType)[keyof typeof ConnectorType],
  toolNames: string[],
) {
  const sql = await getSql();
  const { callTool } = await import("@/lib/app-data/client.server");
  const timeMin = iso(addDays(startOfDay(new Date()), -14));
  const timeMax = iso(addDays(startOfDay(new Date()), 90));
  let lastError = "no matching calendar tool";
  let loginUrl: string | undefined;
  for (const tool of toolNames) {
    const result = await callTool(
      tool,
      { timeMin, timeMax, maxResults: 250, calendarId: "primary" },
      { connectorType },
    );
    if (result.loginRequired) {
      return { loginRequired: true as const, loginUrl: result.loginUrl };
    }
    if (!result.ok) {
      lastError = result.errorMessage ?? lastError;
      continue;
    }
    const events = asList(result.data)
      .map((ev) => normalizeConnector(ev, source.provider))
      .filter(Boolean);
    await replaceSourceEvents(userId, source.id, source.provider, events);
    await sql`
      update calendar_sources
      set last_synced_at = now(), last_error = null
      where id = ${source.id} and user_id = ${userId}
    `;
    return { loginRequired: false as const };
  }
  await sql`
    update calendar_sources
    set last_error = ${lastError}
    where id = ${source.id} and user_id = ${userId}
  `;
  return { loginRequired: false as const, loginUrl, error: lastError };
}

export const listCalendar = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const sources = await sql<Record<string, unknown>>`
      select * from calendar_sources where user_id = ${context.userId} order by created_at
    `;
    const from = iso(addDays(startOfDay(new Date()), -14));
    const to = iso(addDays(startOfDay(new Date()), 90));
    const events = await sql<Record<string, unknown>>`
      select * from calendar_events
      where user_id = ${context.userId}
        and starts_at >= ${from}
        and starts_at <= ${to}
      order by starts_at
    `;
    return {
      sources: sources.map(mapSource),
      events: events.map(mapEvent),
    };
  });

export const addIcsSource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; url: string; provider?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const url = data.url.trim();
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      throw new Error("Use a full http(s) calendar URL");
    }
    const id = nid();
    await sql`
      insert into calendar_sources (id, user_id, provider, name, ics_url)
      values (${id}, ${context.userId}, ${data.provider ?? "zoho"}, ${data.name.trim() || "Calendar"}, ${url})
    `;
    const source: CalendarSource = {
      id,
      provider: data.provider ?? "zoho",
      name: data.name.trim() || "Calendar",
      icsUrl: url,
      enabled: true,
      lastSyncedAt: null,
      lastError: null,
    };
    try {
      await syncIcsSource(context.userId, source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      await sql`
        update calendar_sources set last_error = ${msg} where id = ${id} and user_id = ${context.userId}
      `;
    }
    return { ok: true };
  });

export const connectProvider = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { provider: "google" | "outlook" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<Record<string, unknown>>`
      select * from calendar_sources
      where user_id = ${context.userId} and provider = ${data.provider}
    `;
    let source = existing[0] ? mapSource(existing[0]) : null;
    if (!source) {
      const id = nid();
      const name = data.provider === "google" ? "Google Calendar" : "Outlook";
      await sql`
        insert into calendar_sources (id, user_id, provider, name)
        values (${id}, ${context.userId}, ${data.provider}, ${name})
      `;
      source = {
        id,
        provider: data.provider,
        name,
        icsUrl: null,
        enabled: true,
        lastSyncedAt: null,
        lastError: null,
      };
    }
    if (data.provider === "google") {
      return syncConnector(context.userId, source, ConnectorType.GoogleCalendar, [
        "google_calendar_list_events",
        "list_events",
        "calendar_list_events",
      ]);
    }
    return syncConnector(context.userId, source, ConnectorType.OutlookCalendar, [
      "outlook_calendar_list_events",
      "list_events",
      "calendar_list_events",
    ]);
  });

export const syncCalendars = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const sources = await sql<Record<string, unknown>>`
      select * from calendar_sources where user_id = ${context.userId} and enabled = true
    `;
    let loginUrl: string | undefined;
    for (const row of sources) {
      const source = mapSource(row);
      if (source.icsUrl) {
        try {
          await syncIcsSource(context.userId, source);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Sync failed";
          await sql`
            update calendar_sources set last_error = ${msg}
            where id = ${source.id} and user_id = ${context.userId}
          `;
        }
        continue;
      }
      if (source.provider === "google" || source.provider === "outlook") {
        const result =
          source.provider === "google"
            ? await syncConnector(context.userId, source, ConnectorType.GoogleCalendar, [
                "google_calendar_list_events",
                "list_events",
              ])
            : await syncConnector(context.userId, source, ConnectorType.OutlookCalendar, [
                "outlook_calendar_list_events",
                "list_events",
              ]);
        if (result.loginRequired) loginUrl = result.loginUrl;
      }
    }
    return { loginUrl: loginUrl ?? null };
  });

export const removeSource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from calendar_events where source_id = ${id} and user_id = ${context.userId}`;
    await sql`delete from calendar_sources where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const beginGrokLogin = createServerFn({ method: "POST" })
  .handler(async () => {
    const { callTool } = await import("@/lib/app-data/client.server");
    const result = await callTool(
      "google_calendar_list_events",
      { maxResults: 1 },
      { connectorType: ConnectorType.GoogleCalendar },
    );
    return {
      loginRequired: result.loginRequired === true,
      loginUrl: result.loginUrl ?? null,
      error: result.errorMessage ?? null,
    };
  });

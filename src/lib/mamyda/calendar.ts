import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { parseIcs } from "@/lib/ics";
import { nid } from "@/lib/utils";
import { addDays, iso, startOfDay } from "@/lib/time";
import { mapEvent, mapSource } from "./map";
import { requireTurnstile } from "./turnstile.server";
import { beginCalendarOAuth, listOAuthEvents } from "./calendar-oauth.server";
import type { CalendarSource } from "./types";
import { reconcileEvents } from "./calendar-reconcile.server";

type ConnectorEvent = {
  status?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
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
  if (ev.status === "cancelled" || ev.isCancelled) return null;
  if (!startRaw || !ev.id && !ev.iCalUID) throw new Error("Calendar returned an incomplete event; previous events were kept.");
  const endRaw = ev.end?.dateTime ?? ev.end?.date ?? ev.endTime ?? null;
  const allDay = Boolean(ev.isAllDay || ev.start?.date && !ev.start.dateTime);
  const toDate = (raw: string) => new Date(provider === "outlook" && !/Z$|[+-]\d\d:\d\d$/.test(raw) ? `${raw}Z` : raw).toISOString();
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
    startsAt: toDate(startRaw),
    endsAt: endRaw ? toDate(endRaw) : null,
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
  return reconcileEvents(sql, userId, sourceId, provider, events.filter((ev): ev is NonNullable<typeof ev> => ev !== null));
}

async function syncIcsSource(userId: string, source: CalendarSource) {
  if (!source.icsUrl) throw new Error("Missing calendar URL");
  const { fetchPublicText } = await import("./safe-fetch");
  const text = await fetchPublicText(source.icsUrl);
  if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR")) throw new Error("This URL did not return a valid calendar feed; previous events were kept.");
  const parsed = parseIcs(text);
  const windowStart = addDays(startOfDay(new Date()), -14).getTime();
  const windowEnd = addDays(startOfDay(new Date()), 90).getTime();
  const events = parsed
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t >= windowStart && t <= windowEnd;
    })
    .map((e) => ({
      externalId: e.recurrenceId ? `${e.uid}#${e.recurrenceId}` : e.uid,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      attendees: e.attendees,
    }));
  return replaceSourceEvents(userId, source.id, source.provider, events);
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
        and removed_at is null
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
    await requireTurnstile("calendar-feed");
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
      const eventCount = await syncIcsSource(context.userId, source);
      return { ok: true as const, eventCount };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      await sql`
        update calendar_sources set last_error = ${msg} where id = ${id} and user_id = ${context.userId}
      `;
      return { ok: false as const, error: msg };
    }
  });

export const connectProvider = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { provider: "google" | "outlook" }) => input)
  .handler(async ({ context, data }) => {
    await requireTurnstile("calendar-connect");
    return { ok: true as const, authorizationUrl: await beginCalendarOAuth(context.userId, data.provider) };
  });

export const syncCalendars = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { sourceId?: string } = {}) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const sources = await sql<Record<string, unknown>>`
      select * from calendar_sources where user_id = ${context.userId} and enabled = true
        and (${data.sourceId ?? null}::text is null or id = ${data.sourceId ?? null})
    `;
    const outcomes: Array<{ sourceId: string; name: string; ok: boolean; eventCount?: number; error?: string }> = [];
    for (const row of sources) {
      const source = mapSource(row);
      try {
        let eventCount: number;
        if (source.icsUrl) eventCount = await syncIcsSource(context.userId, source);
        else if (source.provider === "google" || source.provider === "outlook") {
          const events = (await listOAuthEvents(context.userId, source))
            .map((event) => normalizeConnector(event as ConnectorEvent, source.provider))
            .filter((event): event is NonNullable<typeof event> => event !== null);
          eventCount = await replaceSourceEvents(context.userId, source.id, source.provider, events);
        } else throw new Error("Unsupported calendar connection; reconnect in Settings.");
        outcomes.push({ sourceId: source.id, name: source.name, ok: true, eventCount });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed; retry sync.";
        await sql`update calendar_sources set last_error = ${message} where id = ${source.id} and user_id = ${context.userId}`;
        outcomes.push({ sourceId: source.id, name: source.name, ok: false, error: message });
      }
    }
    return { outcomes };
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

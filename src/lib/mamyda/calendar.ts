import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { parseIcs } from "@/lib/ics";
import { nid } from "@/lib/utils";
import { addDays, iso, startOfDay } from "@/lib/time";
import { mapEvent, mapSource } from "./map";
import { requireTurnstile } from "./turnstile.server";
import {
  beginCalendarOAuth,
  createProviderEvent,
  listOAuthEvents,
  updateProviderEvent,
  type CalendarEventWrite,
} from "./calendar-oauth.server";
import type { CalendarSource } from "./types";
import { reconcileEvents } from "./calendar-reconcile.server";
import { calendarEventWriteInput } from "./validation";

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
  if (!startRaw || (!ev.id && !ev.iCalUID))
    throw new Error("Calendar returned an incomplete event; previous events were kept.");
  const endRaw = ev.end?.dateTime ?? ev.end?.date ?? ev.endTime ?? null;
  const allDay = Boolean(ev.isAllDay || (ev.start?.date && !ev.start.dateTime));
  const toDate = (raw: string) =>
    new Date(
      provider === "outlook" && !/Z$|[+-]\d\d:\d\d$/.test(raw) ? `${raw}Z` : raw,
    ).toISOString();
  const loc = typeof ev.location === "string" ? ev.location : (ev.location?.displayName ?? "");
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
  return reconcileEvents(
    sql,
    userId,
    sourceId,
    provider,
    events.filter((ev): ev is NonNullable<typeof ev> => ev !== null),
  );
}

async function syncIcsSource(userId: string, source: CalendarSource) {
  if (!source.icsUrl) throw new Error("Missing calendar URL");
  const { fetchPublicText } = await import("./safe-fetch");
  const text = await fetchPublicText(source.icsUrl);
  if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR"))
    throw new Error("This URL did not return a valid calendar feed; previous events were kept.");
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
      select s.*, c.account_email,
        (s.ics_url is not null or c.user_id is not null) as connected
      from calendar_sources s left join calendar_oauth_connections c
        on c.user_id=s.user_id and c.provider=s.provider
      where s.user_id = ${context.userId} order by s.created_at
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
    return {
      ok: true as const,
      authorizationUrl: await beginCalendarOAuth(context.userId, data.provider),
    };
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
    const outcomes: Array<{
      sourceId: string;
      name: string;
      ok: boolean;
      eventCount?: number;
      error?: string;
    }> = [];
    for (const row of sources) {
      const source = mapSource(row);
      try {
        let eventCount: number;
        if (source.icsUrl) eventCount = await syncIcsSource(context.userId, source);
        else if (source.provider === "google" || source.provider === "outlook") {
          const events = (await listOAuthEvents(context.userId, source))
            .map((event) => normalizeConnector(event as ConnectorEvent, source.provider))
            .filter((event): event is NonNullable<typeof event> => event !== null);
          eventCount = await replaceSourceEvents(
            context.userId,
            source.id,
            source.provider,
            events,
          );
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

async function writeCalendarEvent(
  userId: string,
  data: ReturnType<typeof calendarEventWriteInput.parse>,
) {
  const sql = await getSql();
  const sources = await sql<Record<string, unknown>>`
    select * from calendar_sources where id = ${data.sourceId} and user_id = ${userId} and enabled = true
  `;
  const source = sources[0] ? mapSource(sources[0]) : null;
  if (!source || source.icsUrl || (source.provider !== "google" && source.provider !== "outlook")) {
    throw new Error(
      "Choose a connected Google or Microsoft calendar. Subscription feeds are read-only.",
    );
  }
  if (data.projectId) {
    const project =
      await sql`select id from projects where id = ${data.projectId} and user_id = ${userId} and archived = false`;
    if (!project.length) throw new Error("Choose a project in this workspace.");
  }
  const input: CalendarEventWrite = {
    title: data.title.trim(),
    description: data.description,
    location: data.location,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    allDay: data.allDay,
  };
  const saved = data.eventId
    ? await (async () => {
        const rows = await sql<Record<string, unknown>>`
          select * from calendar_events where id = ${data.eventId} and user_id = ${userId}
            and source_id = ${source.id} and external_id is not null and removed_at is null
        `;
        if (!rows[0])
          throw new Error("This event is no longer available. Sync the calendar and try again.");
        return updateProviderEvent(
          userId,
          source.provider as "google" | "outlook",
          String(rows[0].external_id),
          input,
        );
      })()
    : await createProviderEvent(userId, source.provider as "google" | "outlook", input);
  const normalized = normalizeConnector(saved.event as ConnectorEvent, source.provider);
  if (!normalized)
    throw new Error(
      "The provider saved an event that could not be displayed. Sync the calendar to refresh it.",
    );
  const result = await sql<Record<string, unknown>>`
    insert into calendar_events (id,user_id,source_id,source_provider,external_id,title,description,location,
      starts_at,ends_at,all_day,attendees,project_id,is_sample,removed_at)
    values (${nid()},${userId},${source.id},${source.provider},${normalized.externalId},${normalized.title},
      ${normalized.description},${normalized.location},${normalized.startsAt},${normalized.endsAt},${normalized.allDay},
      ${JSON.stringify(normalized.attendees)},${data.projectId ?? null},false,null)
    on conflict (user_id,source_id,external_id) do update set
      title=excluded.title,description=excluded.description,location=excluded.location,
      starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,
      attendees=excluded.attendees,project_id=excluded.project_id,removed_at=null
    returning *
  `;
  if (!result[0])
    throw new Error(
      "The provider saved the event, but Mamyda could not refresh it. Sync the calendar to reload it.",
    );
  return mapEvent(result[0]);
}

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => calendarEventWriteInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireTurnstile("calendar-event-write");
    return writeCalendarEvent(context.userId, data);
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => calendarEventWriteInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireTurnstile("calendar-event-write");
    if (!data.eventId) throw new Error("Choose an event to update.");
    return writeCalendarEvent(context.userId, data);
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

import { c as __exportAll, r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { n as nid } from "./utils-BeBjTMyx.mjs";
import { c as iso, n as addDays, u as startOfDay } from "./time-B-7xH25t.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { r as getSql } from "./db-DjflF1RW.mjs";
import { i as mapEvent, l as mapSource } from "./map-DPubJFHY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-Crrd1nqC.js
var ConnectorType = {
	GoogleDrive: "GoogleDrive",
	Gmail: "Gmail",
	GoogleCalendar: "GoogleCalendar",
	Outlook: "Outlook",
	OutlookCalendar: "OutlookCalendar",
	MicrosoftTeams: "MicrosoftTeams",
	Mcp: "Mcp"
};
function unfold(ics) {
	return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
function unescapeIcs(value) {
	return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function parseIcsDate(raw) {
	const value = raw.trim();
	if (/^\d{8}$/.test(value)) {
		const y = Number(value.slice(0, 4));
		const m = Number(value.slice(4, 6));
		const d = Number(value.slice(6, 8));
		return {
			iso: new Date(Date.UTC(y, m - 1, d)).toISOString(),
			allDay: true
		};
	}
	const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
	if (!m) return null;
	const [, ys, ms, ds, hs, mins, ss, z] = m;
	if (z) return {
		iso: new Date(Date.UTC(+ys, +ms - 1, +ds, +hs, +mins, +ss)).toISOString(),
		allDay: false
	};
	return {
		iso: new Date(+ys, +ms - 1, +ds, +hs, +mins, +ss).toISOString(),
		allDay: false
	};
}
function field(block, name) {
	const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im");
	const match = block.match(re);
	return match?.[1] ? unescapeIcs(match[1].trim()) : null;
}
function allFields(block, name) {
	const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "gim");
	const out = [];
	for (const match of block.matchAll(re)) if (match[1]) out.push(unescapeIcs(match[1].trim()));
	return out;
}
function parseIcs(ics) {
	const blocks = unfold(ics).split(/BEGIN:VEVENT/i).slice(1);
	const events = [];
	for (const raw of blocks) {
		const block = raw.split(/END:VEVENT/i)[0] ?? raw;
		const dtstartLine = block.match(/^DTSTART([^:\n]*):([^\n]+)/im) ?? null;
		if (!dtstartLine?.[2]) continue;
		const start = parseIcsDate(dtstartLine[2]);
		if (!start) continue;
		const dtendLine = block.match(/^DTEND([^:\n]*):([^\n]+)/im);
		const end = dtendLine?.[2] ? parseIcsDate(dtendLine[2]) : null;
		const title = field(block, "SUMMARY") ?? "(No title)";
		const uid = field(block, "UID") ?? `${title}-${start.iso}`;
		const attendees = allFields(block, "ATTENDEE").map((a) => {
			return a.match(/mailto:([^;]+)/i)?.[1] ?? a;
		}).filter(Boolean);
		events.push({
			uid,
			title,
			description: field(block, "DESCRIPTION") ?? "",
			location: field(block, "LOCATION") ?? "",
			startsAt: start.iso,
			endsAt: end?.iso ?? null,
			allDay: start.allDay,
			attendees
		});
	}
	return events;
}
var calendar_exports = /* @__PURE__ */ __exportAll({
	addIcsSource_createServerFn_handler: () => addIcsSource_createServerFn_handler,
	beginGrokLogin_createServerFn_handler: () => beginGrokLogin_createServerFn_handler,
	connectProvider_createServerFn_handler: () => connectProvider_createServerFn_handler,
	listCalendar_createServerFn_handler: () => listCalendar_createServerFn_handler,
	removeSource_createServerFn_handler: () => removeSource_createServerFn_handler,
	syncCalendars_createServerFn_handler: () => syncCalendars_createServerFn_handler
});
function asList(data) {
	if (Array.isArray(data)) return data;
	if (data && typeof data === "object") {
		const obj = data;
		for (const key of [
			"events",
			"items",
			"value",
			"data"
		]) if (Array.isArray(obj[key])) return obj[key];
	}
	return [];
}
function normalizeConnector(ev, provider) {
	const startRaw = ev.start?.dateTime ?? ev.start?.date ?? ev.startTime;
	if (!startRaw) return null;
	const endRaw = ev.end?.dateTime ?? ev.end?.date ?? ev.endTime ?? null;
	const allDay = Boolean(ev.start?.date && !ev.start.dateTime);
	const loc = typeof ev.location === "string" ? ev.location : ev.location?.displayName ?? "";
	const attendees = (ev.attendees ?? []).map((a) => a.email ?? a.emailAddress?.address ?? "").filter(Boolean);
	return {
		externalId: String(ev.id ?? ev.iCalUID ?? `${provider}-${startRaw}`),
		title: ev.summary ?? ev.title ?? ev.subject ?? "(No title)",
		description: ev.description ?? ev.bodyPreview ?? "",
		location: loc,
		startsAt: new Date(startRaw).toISOString(),
		endsAt: endRaw ? new Date(endRaw).toISOString() : null,
		allDay,
		attendees
	};
}
async function replaceSourceEvents(userId, sourceId, provider, events) {
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
async function syncIcsSource(userId, source) {
	const sql = await getSql();
	if (!source.icsUrl) throw new Error("Missing calendar URL");
	const res = await fetch(source.icsUrl, { redirect: "follow" });
	if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
	const parsed = parseIcs(await res.text());
	const windowStart = addDays(startOfDay(/* @__PURE__ */ new Date()), -14).getTime();
	const windowEnd = addDays(startOfDay(/* @__PURE__ */ new Date()), 90).getTime();
	const events = parsed.filter((e) => {
		const t = new Date(e.startsAt).getTime();
		return t >= windowStart && t <= windowEnd;
	}).map((e) => ({
		externalId: e.uid,
		title: e.title,
		description: e.description,
		location: e.location,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		allDay: e.allDay,
		attendees: e.attendees
	}));
	await replaceSourceEvents(userId, source.id, source.provider, events);
	await sql`
    update calendar_sources
    set last_synced_at = now(), last_error = null
    where id = ${source.id} and user_id = ${userId}
  `;
}
async function syncConnector(userId, source, connectorType, toolNames) {
	const sql = await getSql();
	const { callTool } = await import("./client.server-8xNdqLS6.mjs");
	const timeMin = iso(addDays(startOfDay(/* @__PURE__ */ new Date()), -14));
	const timeMax = iso(addDays(startOfDay(/* @__PURE__ */ new Date()), 90));
	let lastError = "no matching calendar tool";
	let loginUrl;
	for (const tool of toolNames) {
		const result = await callTool(tool, {
			timeMin,
			timeMax,
			maxResults: 250,
			calendarId: "primary"
		}, { connectorType });
		if (result.loginRequired) return {
			loginRequired: true,
			loginUrl: result.loginUrl
		};
		if (!result.ok) {
			lastError = result.errorMessage ?? lastError;
			continue;
		}
		const events = asList(result.data).map((ev) => normalizeConnector(ev, source.provider)).filter(Boolean);
		await replaceSourceEvents(userId, source.id, source.provider, events);
		await sql`
      update calendar_sources
      set last_synced_at = now(), last_error = null
      where id = ${source.id} and user_id = ${userId}
    `;
		return { loginRequired: false };
	}
	await sql`
    update calendar_sources
    set last_error = ${lastError}
    where id = ${source.id} and user_id = ${userId}
  `;
	return {
		loginRequired: false,
		loginUrl,
		error: lastError
	};
}
var listCalendar_createServerFn_handler = createServerRpc({
	id: "aaf51015208128c4a12dca47e9fe1bbe849844e81f5cb02d6a18e467cf4bdacd",
	name: "listCalendar",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => listCalendar.__executeServer(opts));
var listCalendar = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listCalendar_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const sources = await sql`
      select * from calendar_sources where user_id = ${context.userId} order by created_at
    `;
	const from = iso(addDays(startOfDay(/* @__PURE__ */ new Date()), -14));
	const to = iso(addDays(startOfDay(/* @__PURE__ */ new Date()), 90));
	const events = await sql`
      select * from calendar_events
      where user_id = ${context.userId}
        and starts_at >= ${from}
        and starts_at <= ${to}
      order by starts_at
    `;
	return {
		sources: sources.map(mapSource),
		events: events.map(mapEvent)
	};
});
var addIcsSource_createServerFn_handler = createServerRpc({
	id: "fdaa301df6e0a073b34d5f236bd38a2680aa69edfc2a1adac6f7e9e0532a4d56",
	name: "addIcsSource",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => addIcsSource.__executeServer(opts));
var addIcsSource = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(addIcsSource_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const url = data.url.trim();
	if (!url.startsWith("https://") && !url.startsWith("http://")) throw new Error("Use a full http(s) calendar URL");
	const id = nid();
	await sql`
      insert into calendar_sources (id, user_id, provider, name, ics_url)
      values (${id}, ${context.userId}, ${data.provider ?? "zoho"}, ${data.name.trim() || "Calendar"}, ${url})
    `;
	const source = {
		id,
		provider: data.provider ?? "zoho",
		name: data.name.trim() || "Calendar",
		icsUrl: url,
		enabled: true,
		lastSyncedAt: null,
		lastError: null
	};
	try {
		await syncIcsSource(context.userId, source);
	} catch (e) {
		await sql`
        update calendar_sources set last_error = ${e instanceof Error ? e.message : "Sync failed"} where id = ${id} and user_id = ${context.userId}
      `;
	}
	return { ok: true };
});
var connectProvider_createServerFn_handler = createServerRpc({
	id: "dbfa0a99995683c105df3ce6877b126902d5df9a5384b7de96cd122c3e11c5d7",
	name: "connectProvider",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => connectProvider.__executeServer(opts));
var connectProvider = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(connectProvider_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const existing = await sql`
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
			lastError: null
		};
	}
	if (data.provider === "google") return syncConnector(context.userId, source, ConnectorType.GoogleCalendar, [
		"google_calendar_list_events",
		"list_events",
		"calendar_list_events"
	]);
	return syncConnector(context.userId, source, ConnectorType.OutlookCalendar, [
		"outlook_calendar_list_events",
		"list_events",
		"calendar_list_events"
	]);
});
var syncCalendars_createServerFn_handler = createServerRpc({
	id: "41091f29cf08cac80a697ae03814adb877c8b8064d6e3cdc4800d3ca6827ea87",
	name: "syncCalendars",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => syncCalendars.__executeServer(opts));
var syncCalendars = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(syncCalendars_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const sources = await sql`
      select * from calendar_sources where user_id = ${context.userId} and enabled = true
    `;
	let loginUrl;
	for (const row of sources) {
		const source = mapSource(row);
		if (source.icsUrl) {
			try {
				await syncIcsSource(context.userId, source);
			} catch (e) {
				await sql`
            update calendar_sources set last_error = ${e instanceof Error ? e.message : "Sync failed"}
            where id = ${source.id} and user_id = ${context.userId}
          `;
			}
			continue;
		}
		if (source.provider === "google" || source.provider === "outlook") {
			const result = source.provider === "google" ? await syncConnector(context.userId, source, ConnectorType.GoogleCalendar, ["google_calendar_list_events", "list_events"]) : await syncConnector(context.userId, source, ConnectorType.OutlookCalendar, ["outlook_calendar_list_events", "list_events"]);
			if (result.loginRequired) loginUrl = result.loginUrl;
		}
	}
	return { loginUrl: loginUrl ?? null };
});
var removeSource_createServerFn_handler = createServerRpc({
	id: "479af36958893b297c90c8ddea204c0d29211608132374386e55124a2e6690d4",
	name: "removeSource",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => removeSource.__executeServer(opts));
var removeSource = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(removeSource_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await getSql();
	await sql`delete from calendar_events where source_id = ${id} and user_id = ${context.userId}`;
	await sql`delete from calendar_sources where id = ${id} and user_id = ${context.userId}`;
	return { ok: true };
});
var beginGrokLogin_createServerFn_handler = createServerRpc({
	id: "e4fc87d8f6660bded8cd5330e01389a7dd72154d4946da88b4fc25eacb527851",
	name: "beginGrokLogin",
	filename: "src/lib/mamyda/calendar.ts"
}, (opts) => beginGrokLogin.__executeServer(opts));
var beginGrokLogin = createServerFn({ method: "POST" }).handler(beginGrokLogin_createServerFn_handler, async () => {
	const { callTool } = await import("./client.server-8xNdqLS6.mjs");
	const result = await callTool("google_calendar_list_events", { maxResults: 1 }, { connectorType: ConnectorType.GoogleCalendar });
	return {
		loginRequired: result.loginRequired === true,
		loginUrl: result.loginUrl ?? null,
		error: result.errorMessage ?? null
	};
});
//#endregion
export { ConnectorType as r, calendar_exports as t };

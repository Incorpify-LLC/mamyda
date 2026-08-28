//#region node_modules/.nitro/vite/services/ssr/assets/time-B-7xH25t.js
var APP_TZ = "Asia/Kolkata";
function tzParts(date, timeZone = APP_TZ) {
	const fmt = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	});
	const bag = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
	return {
		y: Number(bag.year),
		m: Number(bag.month),
		d: Number(bag.day),
		h: Number(bag.hour),
		min: Number(bag.minute)
	};
}
/** Instant for y-m-d h:min in APP_TZ. */
function zonedDate(y, m, d, h = 0, min = 0, timeZone = APP_TZ) {
	const guess = Date.UTC(y, m - 1, d, h, min, 0);
	const asIf = tzParts(new Date(guess), timeZone);
	const wanted = Date.UTC(y, m - 1, d, h, min, 0);
	const got = Date.UTC(asIf.y, asIf.m - 1, asIf.d, asIf.h, asIf.min, 0);
	return new Date(guess + (wanted - got));
}
function startOfDay(date, timeZone = APP_TZ) {
	const p = tzParts(date, timeZone);
	return zonedDate(p.y, p.m, p.d, 0, 0, timeZone);
}
function addDays(date, days, timeZone = APP_TZ) {
	const p = tzParts(date, timeZone);
	const utc = Date.UTC(p.y, p.m - 1, p.d + days);
	const n = new Date(utc);
	return zonedDate(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, 0, timeZone);
}
function formatTime(iso, timeZone = APP_TZ) {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return new Intl.DateTimeFormat("en-IN", {
		timeZone,
		hour: "numeric",
		minute: "2-digit"
	}).format(d);
}
function formatDay(iso, timeZone = APP_TZ) {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return new Intl.DateTimeFormat("en-IN", {
		timeZone,
		weekday: "short",
		day: "numeric",
		month: "short"
	}).format(d);
}
function formatFullDay(iso, timeZone = APP_TZ) {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return new Intl.DateTimeFormat("en-IN", {
		timeZone,
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric"
	}).format(d);
}
function formatDayKey(iso, timeZone = APP_TZ) {
	const p = tzParts(typeof iso === "string" ? new Date(iso) : iso, timeZone);
	return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
function greeting(now = /* @__PURE__ */ new Date(), timeZone = APP_TZ) {
	const h = tzParts(now, timeZone).h;
	if (h < 5) return "Working late";
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}
function iso(d) {
	return d.toISOString();
}
function sameDay(a, b, timeZone = APP_TZ) {
	return formatDayKey(a, timeZone) === formatDayKey(b, timeZone);
}
//#endregion
export { formatFullDay as a, iso as c, zonedDate as d, formatDayKey as i, sameDay as l, addDays as n, formatTime as o, formatDay as r, greeting as s, APP_TZ as t, startOfDay as u };

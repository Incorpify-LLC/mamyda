export const APP_TZ = "Asia/Kolkata";

function tzParts(
  date: Date,
  timeZone = APP_TZ,
): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(bag.year),
    m: Number(bag.month),
    d: Number(bag.day),
    h: Number(bag.hour),
    min: Number(bag.minute),
  };
}

/** Instant for y-m-d h:min in APP_TZ. */
export function zonedDate(
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  timeZone = APP_TZ,
): Date {
  const guess = Date.UTC(y, m - 1, d, h, min, 0);
  const asIf = tzParts(new Date(guess), timeZone);
  const wanted = Date.UTC(y, m - 1, d, h, min, 0);
  const got = Date.UTC(asIf.y, asIf.m - 1, asIf.d, asIf.h, asIf.min, 0);
  return new Date(guess + (wanted - got));
}

export function startOfDay(date: Date, timeZone = APP_TZ): Date {
  const p = tzParts(date, timeZone);
  return zonedDate(p.y, p.m, p.d, 0, 0, timeZone);
}

export function addDays(date: Date, days: number, timeZone = APP_TZ): Date {
  const p = tzParts(date, timeZone);
  const utc = Date.UTC(p.y, p.m - 1, p.d + days);
  const n = new Date(utc);
  return zonedDate(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, 0, timeZone);
}

export function formatTime(iso: string | Date, timeZone = APP_TZ): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDay(iso: string | Date, timeZone = APP_TZ): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatFullDay(iso: string | Date, timeZone = APP_TZ): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDayKey(iso: string | Date, timeZone = APP_TZ): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = tzParts(d, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function greeting(now = new Date(), timeZone = APP_TZ): string {
  const h = tzParts(now, timeZone).h;
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function sameDay(a: string | Date, b: string | Date, timeZone = APP_TZ): boolean {
  return formatDayKey(a, timeZone) === formatDayKey(b, timeZone);
}

import { APP_TZ, zonedDate } from "./time";

export type ParsedEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  attendees: string[];
};

function unfold(ics: string): string {
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(raw: string, params = ""): { iso: string; allDay: boolean } | null {
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, ys, ms, ds, hs, mins, ss, utc] = match;
  const y = Number(ys),
    m = Number(ms),
    d = Number(ds);
  const h = Number(hs ?? 0),
    minute = Number(mins ?? 0),
    second = Number(ss ?? 0);
  const check = new Date(Date.UTC(y, m - 1, d, h, minute, second));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const timeZone = params.match(/(?:^|;)TZID="?([^;"\r\n]+)/i)?.[1] ?? APP_TZ;
  try {
    const date = utc
      ? check
      : new Date(zonedDate(y, m, d, h, minute, timeZone).getTime() + second * 1000);
    return { iso: date.toISOString(), allDay: hs === undefined };
  } catch {
    // Unsupported timezone or malformed calendar date: skip this entry.
    return null;
  }
}

function field(block: string, name: string): string | null {
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im");
  const match = block.match(re);
  return match?.[1] ? unescapeIcs(match[1].trim()) : null;
}

function allFields(block: string, name: string): string[] {
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "gim");
  const out: string[] = [];
  for (const match of block.matchAll(re)) {
    if (match[1]) out.push(unescapeIcs(match[1].trim()));
  }
  return out;
}

export function parseIcs(ics: string): ParsedEvent[] {
  const text = unfold(ics);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedEvent[] = [];
  for (const raw of blocks) {
    const block = raw.split(/END:VEVENT/i)[0] ?? raw;
    const dtstartLine = block.match(/^DTSTART([^:\n]*):([^\n]+)/im) ?? null;
    if (!dtstartLine?.[2]) continue;
    const start = parseIcsDate(dtstartLine[2], dtstartLine[1]);
    if (!start) continue;
    const dtendLine = block.match(/^DTEND([^:\n]*):([^\n]+)/im);
    const end = dtendLine?.[2] ? parseIcsDate(dtendLine[2], dtendLine[1]) : null;
    const title = field(block, "SUMMARY") ?? "(No title)";
    const uid = field(block, "UID") ?? `${title}-${start.iso}`;
    const attendees = allFields(block, "ATTENDEE")
      .map((a) => {
        const mail = a.match(/mailto:([^;]+)/i);
        return mail?.[1] ?? a;
      })
      .filter(Boolean);
    events.push({
      uid,
      title,
      description: field(block, "DESCRIPTION") ?? "",
      location: field(block, "LOCATION") ?? "",
      startsAt: start.iso,
      endsAt: end?.iso ?? null,
      allDay: start.allDay,
      attendees,
    });
  }
  return events;
}

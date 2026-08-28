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

function parseIcsDate(raw: string): { iso: string; allDay: boolean } | null {
  const value = raw.trim();
  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return { iso: new Date(Date.UTC(y, m - 1, d)).toISOString(), allDay: true };
  }
  const m = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
  );
  if (!m) return null;
  const [, ys, ms, ds, hs, mins, ss, z] = m;
  if (z) {
    return {
      iso: new Date(
        Date.UTC(+ys!, +ms! - 1, +ds!, +hs!, +mins!, +ss!),
      ).toISOString(),
      allDay: false,
    };
  }
  return {
    iso: new Date(
      +ys!,
      +ms! - 1,
      +ds!,
      +hs!,
      +mins!,
      +ss!,
    ).toISOString(),
    allDay: false,
  };
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
    const dtstartLine =
      block.match(/^DTSTART([^:\n]*):([^\n]+)/im) ?? null;
    if (!dtstartLine?.[2]) continue;
    const start = parseIcsDate(dtstartLine[2]);
    if (!start) continue;
    const dtendLine = block.match(/^DTEND([^:\n]*):([^\n]+)/im);
    const end = dtendLine?.[2] ? parseIcsDate(dtendLine[2]) : null;
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

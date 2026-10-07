import { expect, test } from "vitest";
import { parseIcs } from "@/lib/ics";
const event = (start: string) =>
  `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:test\r\nSUMMARY:Standup\r\n${start}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
test("calendar timestamps honor TZID instead of the server timezone", () => {
  expect(parseIcs(event("DTSTART;TZID=Asia/Kolkata:20260910T090000"))[0].startsAt).toBe(
    "2026-09-10T03:30:00.000Z",
  );
});
test("calendar timezone differs from workspace timezone", () => {
  expect(parseIcs(event("DTSTART;TZID=America/New_York:20260910T090000"))[0].startsAt).toBe(
    "2026-09-10T13:00:00.000Z",
  );
});
test("floating calendar timestamps use the workspace timezone", () => {
  expect(parseIcs(event("DTSTART:20260910T090000"))[0].startsAt).toBe("2026-09-10T03:30:00.000Z");
});
test("UTC timestamps remain UTC and invalid dates are skipped", () => {
  expect(parseIcs(event("DTSTART:20260910T090000Z"))[0].startsAt).toBe("2026-09-10T09:00:00.000Z");
  expect(parseIcs(event("DTSTART:20260231T090000Z"))).toHaveLength(0);
});
test("all-day values and escaped/folded text are retained", () => {
  const result = parseIcs(
    event("DTSTART;VALUE=DATE:20260910").replace("SUMMARY:Standup", "SUMMARY:Hello\\, world\r\n !"),
  )[0];
  expect(result.allDay).toBe(true);
  expect(result.title).toBe("Hello, world!");
});

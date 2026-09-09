/*
  The .ics writer, checked by round trip: build a file, parse it back
  with a parser written independently of the writer, and require the
  event to survive.

  The parser below is deliberately naive and shares no code with the
  writer, so a bug in one does not cancel out in the other. It was also
  cross-checked once against ical.js during development, which cannot
  live here because the suite takes no dependencies.

  RFC 5545 is stricter than Google. A file only Google can read is not
  portable, so this tests the spec: CRLF, TEXT escaping, and content
  lines folded at 75 OCTETS rather than characters.
*/
const { loadGlobal } = require("./harness");

/* Unfold, then split each line into name, parameters and value, then
   unescape TEXT. Nothing here is imported from the app. */
function parseIcs(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, "");
  const out = [];
  let current = null;
  for (const line of unfolded.split("\r\n")) {
    if (!line) continue;
    if (line === "BEGIN:VEVENT") { current = { params: {} }; continue; }
    if (line === "END:VEVENT") { out.push(current); current = null; continue; }
    if (!current) continue;
    const colon = line.indexOf(":");
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...params] = left.split(";");
    current[name] = value.replace(/\\n/g, "\n").replace(/\\([;,\\])/g, "$1");
    for (const p of params) {
      const eq = p.indexOf("=");
      current.params[name + "." + p.slice(0, eq)] = p.slice(eq + 1);
    }
  }
  return out;
}

module.exports = function (t) {
  global.TextEncoder = TextEncoder;
  loadGlobal([
    "esc", "eventIsAllDay", "eventStartDate", "eventStartTime",
    "icsEscape", "icsFold", "icsDate", "icsDateTime", "icsStamp",
    "eventToIcs", "icsCalendar", "icsFilename"
  ]);

  const stamp = new Date("2026-09-09T08:58:44Z");
  const trip = {
    id: "e1", summary: "Achill", location: "Mayo", description: "Packing list",
    start: { date: "2026-09-25" }, end: { date: "2026-09-28" },
    recurrence: [], status: "confirmed"
  };
  const lesson = {
    id: "e2", summary: "Psychology",
    start: { dateTime: "2026-09-02T19:30:00", timeZone: "Europe/Madrid" },
    end: { dateTime: "2026-09-02T20:30:00", timeZone: "Europe/Madrid" },
    recurrence: ["RRULE:FREQ=WEEKLY;COUNT=4"], status: "confirmed"
  };

  t.section("the file is well formed");
  const cal = icsCalendar([trip, lesson], stamp);
  t.ok("opens and closes a calendar", cal.startsWith("BEGIN:VCALENDAR\r\n") && cal.trimEnd().endsWith("END:VCALENDAR"));
  t.ok("declares the version", cal.includes("\r\nVERSION:2.0\r\n"));
  t.ok("names the producer", /PRODID:-\/\/Story\/\//.test(cal));
  /* A bare \n is the most common way a hand-written .ics is rejected. */
  t.ok("every line break is CRLF", !/[^\r]\n/.test(cal));
  t.ok("ends with a final CRLF", cal.endsWith("\r\n"));
  t.ok("holds both events", (cal.match(/BEGIN:VEVENT/g) || []).length === 2);

  t.section("an all-day event survives the trip out and back");
  const [outTrip, outLesson] = parseIcs(cal);
  t.ok("the UID is the record's own, so re-importing updates", outTrip.UID === "e1@story-app");
  t.ok("summary survives", outTrip.SUMMARY === "Achill");
  t.ok("location survives", outTrip.LOCATION === "Mayo");
  t.ok("description survives", outTrip.DESCRIPTION === "Packing list");
  t.ok("status is upper case, as the spec wants", outTrip.STATUS === "CONFIRMED");
  t.ok("start is a DATE, not a DATE-TIME", outTrip.params["DTSTART.VALUE"] === "DATE");
  t.ok("start is the first day", outTrip.DTSTART === "20260925");

  /* Stored exclusive, and iCalendar wants exclusive, so this is a copy
     rather than a calculation. Getting it wrong shortens every trip by
     a day in whatever calendar receives it. */
  t.ok("end stays exclusive: the 28th for a trip ending on the 27th", outTrip.DTEND === "20260928");

  t.section("a timed event keeps its wall clock and its zone");
  t.ok("no Z and no offset", !/[Z+]/.test(outLesson.DTSTART));
  t.ok("local wall clock", outLesson.DTSTART === "20260902T193000");
  t.ok("carries the zone as a parameter", outLesson.params["DTSTART.TZID"] === "Europe/Madrid");
  t.ok("end carries it too", outLesson.params["DTEND.TZID"] === "Europe/Madrid");
  t.ok("the rule goes out untouched", outLesson.RRULE === "FREQ=WEEKLY;COUNT=4");
  t.ok("a non-repeating event has no rule", outTrip.RRULE === undefined);

  /* DTSTAMP is defined as UTC, the one place toISOString is correct. */
  t.ok("DTSTAMP is UTC", outTrip.DTSTAMP === "20260909T085844Z");

  t.section("TEXT escaping, in both directions");
  const awkward = {
    id: "e3", summary: 'Lunch; with Nicole, and "Dave"',
    description: "Line one\nLine two\\three",
    start: { date: "2026-09-03" }, end: { date: "2026-09-04" }, recurrence: [], status: "confirmed"
  };
  const rawLine = eventToIcs(awkward, stamp).split("\r\n").find((l) => l.startsWith("SUMMARY"));
  t.ok("a semicolon is escaped on the wire", rawLine.includes("\\;"));
  t.ok("a comma is escaped on the wire", rawLine.includes("\\,"));

  const back = parseIcs(icsCalendar([awkward], stamp))[0];
  t.ok("the semicolon comes back", back.SUMMARY === 'Lunch; with Nicole, and "Dave"');
  t.ok("a newline comes back as a newline", back.DESCRIPTION.includes("\n"));
  t.ok("a backslash comes back", back.DESCRIPTION.includes("\\three"));

  t.section("folding is by octet, not by character");
  /* An emoji is four bytes. Folding on character count emits lines a
     strict parser rejects, and the app has emoji in every Story icon. */
  const long = {
    id: "e4", summary: "✨".repeat(40) + " a long tail of text to push it well past one line",
    start: { date: "2026-09-05" }, end: { date: "2026-09-06" }, recurrence: [], status: "confirmed"
  };
  const folded = icsCalendar([long], stamp);
  const widest = Math.max(...folded.split("\r\n").map((l) => Buffer.byteLength(l, "utf8")));
  t.ok(`no line exceeds 75 octets (widest ${widest})`, widest <= 75);
  t.ok("it did actually need folding", folded.split("\r\n").some((l) => l.startsWith(" ")));
  t.ok("and unfolds back to the original", parseIcs(folded)[0].SUMMARY === long.summary);
  t.ok("no character is split in half", !parseIcs(folded)[0].SUMMARY.includes("\uFFFD"));

  t.section("a short line is left alone");
  t.ok("no stray continuation", !icsFold("SUMMARY:Short").includes("\r\n"));

  /* eventLastDate() supports an event with no end and is tested for it,
     so the writer must not be less forgiving than the reader. RFC 5545
     permits DTSTART with no DTEND. */
  t.section("an event with no end does not break the file");
  const noEnd = { id: "e5", summary: "Open ended",
    start: { dateTime: "2026-09-02T19:30:00", timeZone: "Europe/Madrid" }, status: "confirmed" };
  let blew = null;
  try { icsCalendar([noEnd], stamp); } catch (e) { blew = e; }
  t.ok("it does not throw", blew === null);
  const open_ = parseIcs(icsCalendar([noEnd], stamp))[0];
  t.ok("the start is still written", open_.DTSTART === "20260902T193000");
  t.ok("and DTEND is simply absent", open_.DTEND === undefined);

  const noEndAllDay = { id: "e6", summary: "Open day", start: { date: "2026-09-02" }, status: "confirmed" };
  t.ok("the same for an all-day event", parseIcs(icsCalendar([noEndAllDay], stamp))[0].DTEND === undefined);

  t.section("filenames");
  t.ok("an event is named after itself", icsFilename({ summary: "Sara Carlos Wedding" }) === "sara-carlos-wedding.ics");
  t.ok("punctuation is stripped", icsFilename({ summary: "Lunch; with Nicole!" }) === "lunch-with-nicole.ics");
  t.ok("an emoji-only name still yields a file", icsFilename({ summary: "✨" }) === "event.ics");
  t.ok("the whole calendar has its own name", icsFilename(null) === "story-calendar.ics");
};

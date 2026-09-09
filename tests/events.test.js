/*
  Events follow Google Calendar's event resource shape, so an .ics export
  and any later sync stay a mapping rather than a translation.

  The thing most worth testing is the all-day end convention. Google's
  end.date is EXCLUSIVE, the day after the last day, so a trip on the
  25th to the 27th is stored as end 2026-09-28. Get that wrong in either
  direction and every multi-day event is off by a day, which is the
  classic calendar bug and completely invisible until someone misses a
  flight.
*/
const { loadGlobal, load } = require("./harness");

module.exports = function (t) {
  /* The vendored library the app loads from its own <script> tag. */
  global.rrule = require("../rrule-2.8.1.min.js");
  loadGlobal([
    "esc", "localDate", "todayLocal", "shiftDate", "humanDate",
    "eventIsAllDay", "eventStartDate", "eventStartTime", "eventLastDate",
    "eventSortKey", "eventIsPast", "HORIZON_DAYS", "utcDateOf", "daySpan",
    "eventRule", "eventOccurrences", "occurrencesBetween", "occurrencesOn",
    "eventsAhead", "journeyBehind", "monthCells", "monthLabel", "shiftMonth",
    "aheadDate", "eventWhen", "activeStories", "storyById"
  ]);

  const allDay = (id, summary, from, toLast) => ({
    id, summary, storyId: null,
    start: { date: from },
    end: { date: shiftDate(toLast || from, 1) }
  });
  const timed = (id, summary, date, time) => ({
    id, summary, storyId: null,
    start: { dateTime: `${date}T${time}:00`, timeZone: "Europe/Madrid" },
    end: { dateTime: `${date}T${time}:00`, timeZone: "Europe/Madrid" }
  });

  t.section("reading an event");
  t.ok("an all-day event knows it", eventIsAllDay(allDay("e1", "Birthday", "2026-09-16")) === true);
  t.ok("a timed event knows it", eventIsAllDay(timed("e2", "Psychology", "2026-09-02", "19:30")) === false);
  t.ok("start date, all day", eventStartDate(allDay("e1", "x", "2026-09-16")) === "2026-09-16");
  t.ok("start date, timed", eventStartDate(timed("e2", "x", "2026-09-02", "19:30")) === "2026-09-02");
  t.ok("start time, timed", eventStartTime(timed("e2", "x", "2026-09-02", "19:30")) === "19:30");
  t.ok("start time is empty for all day", eventStartTime(allDay("e1", "x", "2026-09-16")) === "");

  /* The whole point of the convention. */
  t.section("Google's all-day end is exclusive, and nothing human sees it");
  const trip = allDay("e3", "Achill", "2026-09-25", "2026-09-27");
  t.ok("stored end is the day after", trip.end.date === "2026-09-28");
  t.ok("the last day reads as the 27th", eventLastDate(trip) === "2026-09-27");

  const oneDay = allDay("e4", "Birthday", "2026-09-16");
  t.ok("a single all-day event stores end as the next day", oneDay.end.date === "2026-09-17");
  t.ok("and still reads as one day", eventLastDate(oneDay) === "2026-09-16");

  t.ok("a timed event's last day is its own date", eventLastDate(timed("e5", "x", "2026-09-02", "19:30")) === "2026-09-02");
  t.ok(
    "an event with no end at all falls back to its start",
    eventLastDate({ start: { date: "2026-09-16" } }) === "2026-09-16"
  );

  /* Month boundaries are where a naive minus-one goes wrong. */
  t.ok("crossing a month backwards", eventLastDate(allDay("e6", "x", "2026-08-28", "2026-08-31")) === "2026-08-31");
  t.ok("crossing a year backwards", eventLastDate(allDay("e7", "x", "2026-12-29", "2026-12-31")) === "2026-12-31");
  t.ok("a leap day survives", eventLastDate(allDay("e8", "x", "2028-02-27", "2028-02-29")) === "2028-02-29");

  t.section("behind means the last day has passed");
  t.ok("ahead the day before it starts", eventIsPast(trip, "2026-09-24") === false);
  t.ok("still ahead on the first morning", eventIsPast(trip, "2026-09-25") === false);
  /* A trip should not read as history while you are still on it. */
  t.ok("still ahead on the last morning", eventIsPast(trip, "2026-09-27") === false);
  t.ok("behind the next day", eventIsPast(trip, "2026-09-28") === true);

  t.section("what is ahead, in order");
  global.state = {
    stories: [{ id: "q1", name: "Writing", icon: "✎", status: "active", attention: "active" }],
    journey: [
      { id: "a1", storyId: "q1", stepId: null, note: "Wrote", date: "2026-09-01" },
      { id: "a2", storyId: "q1", stepId: null, note: "Read", date: "2026-09-05" }
    ],
    events: [
      allDay("e-late", "Achill", "2026-09-25", "2026-09-27"),
      timed("e-eve", "Psychology", "2026-09-16", "19:30"),
      timed("e-morn", "Lunch", "2026-09-16", "13:00"),
      allDay("e-past", "Old thing", "2026-09-03")
    ]
  };
  const today = "2026-09-09";
  const ahead = eventsAhead(today);
  t.ok("the past one is not ahead", !ahead.some(o => o.rec.id === "e-past"));
  t.ok("soonest first", ahead[0].rec.id === "e-morn");
  t.ok("same day sorts by time", ahead[1].rec.id === "e-eve");
  t.ok("then the later date", ahead[2].rec.id === "e-late");
  t.ok("three ahead in total", ahead.length === 3);

  /* Past events are Journey entries: both are things that happened on a
     date. Merged, never converted, so the record stays an event. */
  t.section("past events fold into the Journey");
  const behind = journeyBehind(null, today);
  t.ok("the past event is in it", behind.some(x => x.type === "event" && x.rec.id === "e-past"));
  t.ok("the journey entries are too", behind.filter(x => x.type === "journey").length === 2);
  t.ok("future events are not", !behind.some(x => x.rec.id === "e-late"));
  t.ok("newest first", behind[0].date === "2026-09-05");
  t.ok("oldest last", behind[behind.length - 1].date === "2026-09-01");

  t.ok("nothing was converted: the event is still an event", state.events.some(e => e.id === "e-past"));
  t.ok("and was not copied into the journey list", !state.journey.some(a => a.id === "e-past"));

  t.section("filtering a Story's own");
  state.events.push({ ...allDay("e-mine", "Filed", "2026-09-02"), storyId: "q1" });
  t.ok("an unfiled event is not in a Story's Journey", !journeyBehind("q1", today).some(x => x.rec.id === "e-past"));
  t.ok("a filed one is", journeyBehind("q1", today).some(x => x.rec.id === "e-mine"));
  t.ok("everything shows in the unfiltered view", journeyBehind(null, today).some(x => x.rec.id === "e-past"));

  /* Ahead needs its own vocabulary. humanDate only looks backwards, and
     an event is a fact on a date, never a deadline, so nothing here
     counts down or goes red. */
  t.section("ahead reads as a date, not a deadline");
  t.ok("today", aheadDate("2026-09-09", today) === "Today");
  t.ok("tomorrow", aheadDate("2026-09-10", today) === "Tomorrow");
  t.ok("within the week", aheadDate("2026-09-12", today) === "In 3 days");
  t.ok("further out falls back to a date", /Sep/.test(aheadDate("2026-09-25", today)));
  t.ok("something already today does not go negative", aheadDate("2026-09-08", today) === "Today");

  t.section("how an event describes itself");
  const occ = (e) => ({ date: eventStartDate(e), last: eventLastDate(e), rec: e });
  t.ok("a timed one names the time", eventWhen(occ(timed("x", "y", "2026-09-10", "19:30")), today).includes("at 19:30"));
  t.ok("an all-day one does not", !eventWhen(occ(allDay("x", "y", "2026-09-10")), today).includes("at "));
  t.ok("a span says where it ends", /to/.test(eventWhen(occ(trip), today)));
  t.ok("a single day does not", !/to/.test(eventWhen(occ(allDay("x", "y", "2026-09-10")), today)));

  /* The write side. A modal reads fields and must store Google's
     exclusive end, or every multi-day event is saved a day short. */
  t.section("writing an event back out");
  const { readEventForm } = load(["readEventForm", "val", "shiftDate", "localDate", "todayLocal"]);
  const fields = {};
  global.document = { getElementById: (id) => ({ value: fields[id] === undefined ? "" : fields[id] }) };
  global.toast = () => {};

  Object.assign(fields, {
    eventSummary: "Achill", eventAllDay: "yes",
    eventStart: "2026-09-25", eventEnd: "2026-09-27",
    eventLocation: "", eventDescription: "", eventStory: ""
  });
  const written = readEventForm();
  t.ok("start is the first day", written.start.date === "2026-09-25");
  t.ok("end is stored exclusive", written.end.date === "2026-09-28");
  t.ok("no time on an all-day event", written.start.dateTime === undefined);
  t.ok("an unfiled event stores null, not empty string", written.storyId === null);

  Object.assign(fields, {
    eventAllDay: "no", eventStart: "2026-09-02", eventEnd: "2026-09-02",
    eventStartTime: "19:30", eventEndTime: "20:30"
  });
  const timedOut = readEventForm();
  t.ok("a timed event stores local wall clock", timedOut.start.dateTime === "2026-09-02T19:30:00");
  t.ok("with a zone beside it, Google's shape", typeof timedOut.start.timeZone === "string");
  t.ok("and never a Z or an offset", !/[Z+]/.test(timedOut.start.dateTime));
  t.ok("end carries the end time", timedOut.end.dateTime === "2026-09-02T20:30:00");

  /* An end before the start would store a negative span and read as
     already behind you. */
  Object.assign(fields, { eventAllDay: "yes", eventStart: "2026-09-25", eventEnd: "2026-09-20" });
  const backwards = readEventForm();
  t.ok("an end before the start is pulled up to the start", backwards.end.date === "2026-09-26");

  Object.assign(fields, { eventSummary: "Rent", eventRepeat: "FREQ=MONTHLY" });
  t.ok("a repeat is stored Google's way", JSON.stringify(readEventForm().recurrence) === '["RRULE:FREQ=MONTHLY"]');
  fields.eventRepeat = "";
  t.ok("no repeat stores an empty list", readEventForm().recurrence.length === 0);

  fields.eventSummary = "";
  t.ok("an event with no name is refused", readEventForm() === null);

  /* --- recurrence ---------------------------------------------------- */
  /* The reason rrule is vendored rather than hand-rolled. */
  t.section("a rule expands into occurrences");
  const repeating = (id, summary, from, rule, time) => ({
    id, summary, storyId: null, recurrence: ["RRULE:" + rule],
    ...(time
      ? { start: { dateTime: `${from}T${time}:00`, timeZone: "Europe/Madrid" },
          end: { dateTime: `${from}T${time}:00`, timeZone: "Europe/Madrid" } }
      : { start: { date: from }, end: { date: shiftDate(from, 1) } })
  });

  const rent = repeating("r1", "Rent", "2026-09-29", "FREQ=MONTHLY;BYMONTHDAY=29");
  const rentDates = eventOccurrences(rent, "2026-09-01", "2027-01-31").map(o => o.date);
  t.ok("monthly lands on the same day each month",
    rentDates.slice(0, 4).join(" ") === "2026-09-29 2026-10-29 2026-11-29 2026-12-29");

  const bday = repeating("b1", "David G birthday", "2026-09-16", "FREQ=YEARLY");
  const years = eventOccurrences(bday, "2026-01-01", "2029-12-31").map(o => o.date);
  t.ok("yearly repeats on the date", years.join(" ") === "2026-09-16 2027-09-16 2028-09-16 2029-09-16");

  /* A birthday is the 16th everywhere. Expanding through local time
     drifts it across a DST boundary, which is exactly the bug that
     makes a yearly event land on the 15th in some years. */
  t.ok("a yearly event never drifts a day", years.every(d => d.endsWith("-09-16")));

  const weekly = repeating("w1", "Psychology", "2026-09-02", "FREQ=WEEKLY;COUNT=4", "19:30");
  const weeks = eventOccurrences(weekly, "2026-09-01", "2026-12-31").map(o => o.date);
  t.ok("weekly steps by seven", weeks.join(" ") === "2026-09-02 2026-09-09 2026-09-16 2026-09-23");
  t.ok("COUNT is honoured", weeks.length === 4);
  t.ok("a timed repeat keeps its time", eventStartTime(weekly) === "19:30");

  /* Spain moves its clocks on 2026-10-25. A weekly evening event either
     side of that must stay on the same weekday at the same wall time. */
  const across = repeating("d1", "Evening", "2026-10-18", "FREQ=WEEKLY;COUNT=3", "19:30");
  t.ok("a weekly event survives a clock change",
    eventOccurrences(across, "2026-10-01", "2026-11-30").map(o => o.date).join(" ") ===
    "2026-10-18 2026-10-25 2026-11-01");

  t.section("a repeating multi-day event keeps its span");
  const trips = { id: "t9", summary: "Achill", storyId: null,
    recurrence: ["RRULE:FREQ=YEARLY;COUNT=2"],
    start: { date: "2026-09-25" }, end: { date: "2026-09-28" } };
  const spans = eventOccurrences(trips, "2026-01-01", "2027-12-31");
  t.ok("each occurrence spans the same days", spans.every(o => o.last === shiftDate(o.date, 2)));
  t.ok("and repeats yearly", spans.map(o => o.date).join(" ") === "2026-09-25 2027-09-25");

  /* A window opening mid-trip must still find it, or a multi-day event
     vanishes from the calendar on its second day. */
  t.ok("a window opening mid-trip still finds it",
    eventOccurrences(trips, "2026-09-26", "2026-09-26").length === 1);

  t.section("a rule the UI cannot express is not lost");
  const odd = repeating("o1", "Third Friday", "2026-09-18", "FREQ=MONTHLY;BYDAY=FR;BYSETPOS=3");
  const fridays = eventOccurrences(odd, "2026-09-01", "2026-12-31").map(o => o.date);
  t.ok("BYSETPOS expands correctly", fridays.join(" ") === "2026-09-18 2026-10-16 2026-11-20 2026-12-18");
  /* A rule that cannot be parsed must not take the whole view down with
     it. It degrades to a one-off rather than throwing mid-render. */
  const broken = { id: "x1", summary: "Bad rule", storyId: null,
    recurrence: ["RRULE:FREQ=NONSENSE"], start: { date: "2026-01-01" }, end: { date: "2026-01-02" } };
  let threw = null;
  try { eventRule(broken); } catch (e) { threw = e; }
  t.ok("an unparseable rule returns null instead of throwing", threw === null && eventRule(broken) === null);
  t.ok("and the event still appears once", eventOccurrences(broken, "2026-01-01", "2026-12-31").length === 1);

  t.section("repeating events reach the Journey too");
  global.state = { stories: [], journey: [], events: [bday] };
  const past = journeyBehind(null, "2027-01-01");
  t.ok("last year's birthday is behind you", past.some(x => x.date === "2026-09-16"));
  t.ok("next year's is not", !past.some(x => x.date === "2027-09-16"));

  /* --- the month grid ------------------------------------------------ */
  t.section("the month grid");
  const sept = monthCells(2026, 9);
  t.ok("starts on a Monday", new Date(sept[0].date + "T12:00:00Z").getUTCDay() === 1);
  t.ok("is whole weeks", sept.length % 7 === 0);
  t.ok("September 2026 needs five rows, not six", sept.length === 35);
  t.ok("leads with the tail of August", sept[0].date === "2026-08-31" && sept[0].inMonth === false);
  t.ok("contains every day of the month", sept.filter(c => c.inMonth).length === 30);
  t.ok("ends with the start of October", sept[sept.length - 1].inMonth === false);

  /* A month starting on a Sunday is the awkward one: it needs six rows. */
  const march = monthCells(2026, 3);
  t.ok("a Sunday start still starts on Monday", march[0].date === "2026-02-23");
  t.ok("and takes six rows", march.length === 42);
  t.ok("February 2028 is a leap month", monthCells(2028, 2).filter(c => c.inMonth).length === 29);

  t.section("moving between months");
  t.ok("forward", JSON.stringify(shiftMonth(2026, 9, 1)) === '{"year":2026,"month":10}');
  t.ok("back", JSON.stringify(shiftMonth(2026, 9, -1)) === '{"year":2026,"month":8}');
  t.ok("across a year end", JSON.stringify(shiftMonth(2026, 12, 1)) === '{"year":2027,"month":1}');
  t.ok("across a year start", JSON.stringify(shiftMonth(2026, 1, -1)) === '{"year":2025,"month":12}');
  t.ok("the label names the month", /September/.test(monthLabel(2026, 9)));

  t.section("what falls on a given day");
  global.state = { stories: [], journey: [], events: [rent, bday, trips] };
  t.ok("a repeat is found on a later occurrence", occurrencesOn("2026-11-29").length === 1);
  t.ok("a day in the middle of a trip counts", occurrencesOn("2026-09-26").some(o => o.rec.id === "t9"));
  t.ok("an empty day is empty", occurrencesOn("2026-09-05").length === 0);
};

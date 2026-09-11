/*
  The list under the month grid. It covers the rest of the current
  month, or the whole of any other month, so it has a job the Timeline's
  "ahead" list does not. Tapping a day narrows it to that day.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  loadGlobal([
    "monthListRange", "shortDate", "aheadDate", "eventWhen", "eventIsAllDay", "eventStartTime"
  ]);

  t.section("what the month list covers");
  const cur = monthListRange(2026, 9, "2026-09-11");
  t.ok("the current month starts today", cur.from === "2026-09-11");
  t.ok("and runs to its last day", cur.to === "2026-09-30");
  const next = monthListRange(2026, 10, "2026-09-11");
  t.ok("a later month starts on the 1st", next.from === "2026-10-01" && next.to === "2026-10-31");
  const prev = monthListRange(2026, 8, "2026-09-11");
  t.ok("an earlier month is the whole month", prev.from === "2026-08-01" && prev.to === "2026-08-31");
  t.ok("today on the 1st is still the 1st", monthListRange(2026, 9, "2026-09-01").from === "2026-09-01");
  t.ok("today on the last day", monthListRange(2026, 9, "2026-09-30").from === "2026-09-30");
  t.ok("February in a leap year", monthListRange(2028, 2, "2026-09-11").to === "2028-02-29");
  t.ok("February otherwise", monthListRange(2027, 2, "2026-09-11").to === "2027-02-28");
  t.ok("December", monthListRange(2026, 12, "2026-09-11").to === "2026-12-31");

  t.section("when a listed event reads");
  const allDay = (date, last) => ({ date, last, rec: { start: { date } } });
  const today = "2026-09-11";
  t.ok("tomorrow is relative", eventWhen(allDay("2026-09-12", "2026-09-12"), today) === "Tomorrow");
  t.ok("a trip under way reads Today", eventWhen(allDay("2026-09-10", "2026-09-12"), today).startsWith("Today"));
  const past = eventWhen(allDay("2026-08-03", "2026-08-03"), today);
  t.ok("a passed event reads as its date, not Today", past === shortDate("2026-08-03"));
  t.ok("a day view shows no day", eventWhen(allDay("2026-09-12", "2026-09-12"), today, false) === "");
  const timed = { date: "2026-09-13", last: "2026-09-13", rec: { start: { dateTime: "2026-09-13T23:05:00" } } };
  t.ok("a timed event keeps its time", eventWhen(timed, today) === "In 2 days at 23:05");
};

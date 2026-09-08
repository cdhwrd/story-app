/*
  Practice mode: a Step with mode:"practice" never completes, it
  accumulates marks. See README, "Steps and Practices".
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  let toasts = [];
  let stamps = [];
  global.save = () => {};
  global.toast = (m) => toasts.push(m);
  global.showStamp = (l) => stamps.push(l);
  global.openStory = () => {};
  global.renderHome = () => {};
  global.currentStory = "q1";
  global.state = { steps: [], journey: [] };

  loadGlobal([
    "todayLocal", "humanDate", "stepsIn", "openStepsIn", "practices",
    "onceSteps", "markCount", "plural", "marksLine", "markPractice", "completeStep",
    "newId", "lastMarkFor", "uncompleteEntry"
  ]);

  function reset() {
    state.steps = [
      { id: "t1", storyId: "q1", title: "Write 200 words", status: "open", mode: "practice", anchor: "after coffee" },
      { id: "t2", storyId: "q1", title: "Book dentist", status: "open" },
      { id: "t3", storyId: "q1", title: "Legacy step, no mode field", status: "open" }
    ];
    state.journey = [];
    toasts = [];
    stamps = [];
  }
  const today = todayLocal();

  t.section("marking a practice");
  reset();
  markPractice("t1");
  t.ok("stays open", state.steps[0].status === "open");
  t.ok("still listed as a practice", practices("q1").length === 1);
  t.ok("writes one Journey entry", state.journey.length === 1);
  t.ok("entry is flagged as a practice", state.journey[0].kind === "practice");
  t.ok("entry keeps the foreign key", state.journey[0].stepId === "t1");
  t.ok("no completedAt is set", state.steps[0].completedAt === undefined);
  t.ok("shows the practice stamp", stamps[0] === "PRACTICE MARKED");

  t.section("marking more than once a day is allowed");
  markPractice("t1");
  t.ok("a second mark is recorded", state.journey.length === 2);
  t.ok("count reaches two", markCount(state.steps[0]) === 2);
  t.ok("nothing is refused", !toasts.includes("Already marked today"));
  t.ok("both entries have distinct ids", state.journey[0].id !== state.journey[1].id);

  t.section("marking again on a later day");
  state.steps[0].lastMarkedAt = "2020-01-01";
  markPractice("t1");
  t.ok("count reaches three", markCount(state.steps[0]) === 3);
  t.ok("lastMarkedAt moves to today", state.steps[0].lastMarkedAt === today);

  t.section("a practice cannot be completed");
  reset();
  completeStep("t1");
  t.ok("routed to marking instead", state.steps[0].status === "open");
  t.ok("does not vanish from the list", openStepsIn("q1").some((x) => x.id === "t1"));

  t.section("one-off steps are unchanged");
  reset();
  completeStep("t2");
  const t2 = state.steps.find((x) => x.id === "t2");
  t.ok("completes", t2.status === "complete");
  t.ok("leaves the open list", !openStepsIn("q1").some((x) => x.id === "t2"));
  t.ok("its entry carries no practice flag", state.journey[0].kind === undefined);

  t.section("steps written before practices existed");
  reset();
  t.ok("an absent mode reads as one-off", onceSteps("q1").some((x) => x.id === "t3"));
  t.ok("and is not a practice", !practices("q1").some((x) => x.id === "t3"));
  completeStep("t3");
  t.ok("still completes normally", state.steps.find((x) => x.id === "t3").status === "complete");

  t.section("the marks line never implies a miss");
  reset();
  const zero = marksLine(state.steps[0]);
  t.ok("zero marks reads as an invitation", zero === "Ready when you are");
  markPractice("t1");
  const one = marksLine(state.steps[0]);
  t.ok("marked today is acknowledged", one.indexOf("Marked today") === 0);
  state.steps[0].lastMarkedAt = "2020-01-01";
  markPractice("t1");
  state.steps[0].lastMarkedAt = "2020-01-02";
  const many = marksLine(state.steps[0]);
  t.ok("plural marks read correctly", many.indexOf("2 marks") === 0);
  const banned = /overdue|missed|late|failed|streak|behind|broken/i;
  t.ok("no failure language anywhere", ![zero, one, many].some((s) => banned.test(s)));
};

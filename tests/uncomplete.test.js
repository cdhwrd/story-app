/*
  Unticking a Journey entry. For a step this puts it back on the list;
  for a practice mark it removes just that mark. Both remove the entry.

  The subtle case is lastMarkedAt. It must be recomputed from surviving
  entries, not cleared, or removing an old mark would wrongly un-mark
  today and the trigger would show the wrong state.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  global.save = () => {};
  global.toast = () => {};
  global.showStamp = () => {};
  global.openStory = () => {};
  global.renderHome = () => {};
  global.currentStory = "q1";
  global.state = { steps: [], journey: [] };

  loadGlobal([
    "todayLocal", "humanDate", "esc", "newId", "plural", "stepsIn", "openStepsIn",
    "practices", "onceSteps", "markCount", "marksLine", "lastMarkFor",
    "markPractice", "completeStep", "uncompleteEntry", "journalEntry"
  ]);

  const today = todayLocal();

  function reset() {
    state.steps = [
      { id: "s1", storyId: "q1", title: "Book dentist", status: "open" },
      { id: "p1", storyId: "q1", title: "Write", status: "open", mode: "practice" }
    ];
    state.journey = [];
  }

  t.section("unticking a completed step");
  reset();
  completeStep("s1");
  const entry = state.journey[0].id;
  t.ok("step was completed", state.steps[0].status === "complete");
  uncompleteEntry(entry);
  t.ok("step is open again", state.steps[0].status === "open");
  t.ok("completedAt is cleared", state.steps[0].completedAt === undefined);
  t.ok("it returns to the open list", openStepsIn("q1").some((x) => x.id === "s1"));
  t.ok("the entry is gone", state.journey.length === 0);

  t.section("unticking one of several practice marks");
  reset();
  markPractice("p1");
  markPractice("p1");
  markPractice("p1");
  t.ok("three marks recorded", markCount(state.steps[1]) === 3);
  uncompleteEntry(state.journey[1].id);
  t.ok("only that mark is removed", markCount(state.steps[1]) === 2);
  t.ok("the practice stays open", state.steps[1].status === "open");
  t.ok("still marked today", state.steps[1].lastMarkedAt === today);

  t.section("removing an older mark does not un-mark today");
  reset();
  markPractice("p1");
  state.journey[0].date = "2020-01-01";
  markPractice("p1");
  const older = state.journey.find((a) => a.date === "2020-01-01").id;
  uncompleteEntry(older);
  t.ok("lastMarkedAt still reflects the surviving mark", state.steps[1].lastMarkedAt === today);

  t.section("removing today's mark falls back to the older one");
  reset();
  markPractice("p1");
  state.journey[0].date = "2020-01-01";
  markPractice("p1");
  const todays = state.journey.find((a) => a.date === today).id;
  uncompleteEntry(todays);
  t.ok("falls back to the earlier date", state.steps[1].lastMarkedAt === "2020-01-01");
  t.ok("no longer counts as marked today", state.steps[1].lastMarkedAt !== today);

  t.section("removing the only mark");
  reset();
  markPractice("p1");
  uncompleteEntry(state.journey[0].id);
  t.ok("lastMarkedAt becomes null", state.steps[1].lastMarkedAt === null);
  t.ok("count is zero", markCount(state.steps[1]) === 0);
  t.ok("reads as never marked", marksLine(state.steps[1]) === "Ready when you are");

  t.section("entries with nothing behind them");
  reset();
  state.journey.push({ id: "a-manual", storyId: "q1", stepId: null, note: "Went for a swim", date: today });
  uncompleteEntry("a-manual");
  t.ok("a manual entry is not removed by uncomplete", state.journey.length === 1);
  t.ok("its markup has no checkbox", !journalEntry(state.journey[0]).includes("data-uncomplete"));
  t.ok("an entry whose step was deleted is also left alone",
    (() => {
      state.journey.push({ id: "a-orphan", storyId: "q1", stepId: "gone", note: "x", date: today });
      uncompleteEntry("a-orphan");
      return state.journey.some((a) => a.id === "a-orphan");
    })());

  t.section("checkbox appears only where something can be put back");
  reset();
  completeStep("s1");
  const html = journalEntry(state.journey[0]);
  t.ok("a step entry gets a checkbox", html.includes("data-uncomplete"));
  t.ok("it renders as already ticked", html.includes("checked"));
  state.steps = [];
  t.ok("no checkbox once the step itself is deleted", !journalEntry(state.journey[0]).includes("data-uncomplete"));

  t.section("unknown entries are ignored");
  reset();
  completeStep("s1");
  uncompleteEntry("does-not-exist");
  t.ok("nothing is removed", state.journey.length === 1);
  t.ok("the step stays complete", state.steps[0].status === "complete");

  t.section("ids are unique under rapid marking");
  reset();
  for (let i = 0; i < 200; i++) markPractice("p1");
  t.ok("200 marks produce 200 distinct ids", new Set(state.journey.map((a) => a.id)).size === 200);
};

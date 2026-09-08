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
  global.state = { tasks: [], activities: [] };

  loadGlobal([
    "todayLocal", "humanDate", "esc", "newId", "plural", "tasks", "openTasks",
    "practices", "onceSteps", "markCount", "marksLine", "lastMarkFor",
    "markPractice", "completeStep", "uncompleteEntry", "journalEntry"
  ]);

  const today = todayLocal();

  function reset() {
    state.tasks = [
      { id: "s1", questId: "q1", title: "Book dentist", status: "open" },
      { id: "p1", questId: "q1", title: "Write", status: "open", mode: "practice" }
    ];
    state.activities = [];
  }

  t.section("unticking a completed step");
  reset();
  completeStep("s1");
  const entry = state.activities[0].id;
  t.ok("step was completed", state.tasks[0].status === "complete");
  uncompleteEntry(entry);
  t.ok("step is open again", state.tasks[0].status === "open");
  t.ok("completedAt is cleared", state.tasks[0].completedAt === undefined);
  t.ok("it returns to the open list", openTasks("q1").some((x) => x.id === "s1"));
  t.ok("the entry is gone", state.activities.length === 0);

  t.section("unticking one of several practice marks");
  reset();
  markPractice("p1");
  markPractice("p1");
  markPractice("p1");
  t.ok("three marks recorded", markCount(state.tasks[1]) === 3);
  uncompleteEntry(state.activities[1].id);
  t.ok("only that mark is removed", markCount(state.tasks[1]) === 2);
  t.ok("the practice stays open", state.tasks[1].status === "open");
  t.ok("still marked today", state.tasks[1].lastMarkedAt === today);

  t.section("removing an older mark does not un-mark today");
  reset();
  markPractice("p1");
  state.activities[0].date = "2020-01-01";
  markPractice("p1");
  const older = state.activities.find((a) => a.date === "2020-01-01").id;
  uncompleteEntry(older);
  t.ok("lastMarkedAt still reflects the surviving mark", state.tasks[1].lastMarkedAt === today);

  t.section("removing today's mark falls back to the older one");
  reset();
  markPractice("p1");
  state.activities[0].date = "2020-01-01";
  markPractice("p1");
  const todays = state.activities.find((a) => a.date === today).id;
  uncompleteEntry(todays);
  t.ok("falls back to the earlier date", state.tasks[1].lastMarkedAt === "2020-01-01");
  t.ok("no longer counts as marked today", state.tasks[1].lastMarkedAt !== today);

  t.section("removing the only mark");
  reset();
  markPractice("p1");
  uncompleteEntry(state.activities[0].id);
  t.ok("lastMarkedAt becomes null", state.tasks[1].lastMarkedAt === null);
  t.ok("count is zero", markCount(state.tasks[1]) === 0);
  t.ok("reads as never marked", marksLine(state.tasks[1]) === "Ready when you are");

  t.section("entries with nothing behind them");
  reset();
  state.activities.push({ id: "a-manual", questId: "q1", taskId: null, note: "Went for a swim", date: today });
  uncompleteEntry("a-manual");
  t.ok("a manual entry is not removed by uncomplete", state.activities.length === 1);
  t.ok("its markup has no checkbox", !journalEntry(state.activities[0]).includes("data-uncomplete"));
  t.ok("an entry whose step was deleted is also left alone",
    (() => {
      state.activities.push({ id: "a-orphan", questId: "q1", taskId: "gone", note: "x", date: today });
      uncompleteEntry("a-orphan");
      return state.activities.some((a) => a.id === "a-orphan");
    })());

  t.section("checkbox appears only where something can be put back");
  reset();
  completeStep("s1");
  const html = journalEntry(state.activities[0]);
  t.ok("a step entry gets a checkbox", html.includes("data-uncomplete"));
  t.ok("it renders as already ticked", html.includes("checked"));
  state.tasks = [];
  t.ok("no checkbox once the step itself is deleted", !journalEntry(state.activities[0]).includes("data-uncomplete"));

  t.section("unknown entries are ignored");
  reset();
  completeStep("s1");
  uncompleteEntry("does-not-exist");
  t.ok("nothing is removed", state.activities.length === 1);
  t.ok("the step stays complete", state.tasks[0].status === "complete");

  t.section("ids are unique under rapid marking");
  reset();
  for (let i = 0; i < 200; i++) markPractice("p1");
  t.ok("200 marks produce 200 distinct ids", new Set(state.activities.map((a) => a.id)).size === 200);
};

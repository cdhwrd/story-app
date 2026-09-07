/*
  The home Steps view, and where completing a step returns you to.
  See README, "Home views".
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  let nav = [];
  global.save = () => {};
  global.toast = () => {};
  global.showStamp = () => {};
  global.openStory = (id) => nav.push("story:" + id);
  global.renderHome = () => nav.push("home");
  global.currentStory = null;
  global.state = { tasks: [], activities: [] };

  loadGlobal([
    "todayLocal", "humanDate", "tasks", "openTasks", "practices",
    "onceSteps", "markCount", "flatSteps", "marksLine", "markPractice",
    "completeStep"
  ]);

  function reset() {
    state.tasks = [
      { id: "a", questId: "q1", title: "Oldest", status: "open", createdAt: "2026-01-01T09:00:00Z" },
      { id: "b", questId: "q2", title: "Newest", status: "open", createdAt: "2026-06-01T09:00:00Z" },
      { id: "c", questId: "q1", title: "A practice", status: "open", mode: "practice", createdAt: "2026-05-01T09:00:00Z" },
      { id: "d", questId: "q1", title: "Already done", status: "complete", createdAt: "2026-03-01T09:00:00Z" },
      { id: "e", questId: "qPaused", title: "In a paused story", status: "open", createdAt: "2026-04-01T09:00:00Z" },
      { id: "f", questId: "q1", title: "Legacy, no createdAt", status: "open" }
    ];
    state.activities = [];
    nav = [];
    global.currentStory = null;
  }
  const active = new Set(["q1", "q2"]);

  t.section("what the flat list contains");
  reset();
  const ids = flatSteps(active).map((x) => x.id);
  t.ok("includes open one-off steps", ids.includes("a") && ids.includes("b"));
  t.ok("excludes practices", !ids.includes("c"));
  t.ok("excludes completed steps", !ids.includes("d"));
  t.ok("excludes steps in inactive stories", !ids.includes("e"));
  t.ok("keeps steps with no createdAt", ids.includes("f"));

  t.section("ordering");
  t.ok("newest first", ids[0] === "b");
  t.ok("the stalest item is not surfaced first", ids[0] !== "a");
  t.ok("undated sorts last", ids[ids.length - 1] === "f");

  t.section("completing from the home list");
  reset();
  completeStep("a");
  t.ok("the step completes", state.tasks[0].status === "complete");
  t.ok("stays on home", nav.length === 1 && nav[0] === "home");
  t.ok("does not jump into the story", !nav.some((n) => n.startsWith("story:")));
  t.ok("leaves the flat list", !flatSteps(active).some((x) => x.id === "a"));

  t.section("completing from inside a story");
  reset();
  global.currentStory = "q1";
  completeStep("a");
  t.ok("returns to that story", nav[0] === "story:q1");

  t.section("marking a practice from inside a story");
  reset();
  global.currentStory = "q1";
  markPractice("c");
  t.ok("the practice stays open", state.tasks[2].status === "open");
  t.ok("returns to the story", nav[0] === "story:q1");
  t.ok("never appears in the flat list", !flatSteps(active).some((x) => x.id === "c"));
};

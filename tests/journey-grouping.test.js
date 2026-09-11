/*
  The Story page Journey, grouped by chapter. An entry finds its chapter
  through its step and that step's goal; nothing is stored on the entry.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  global.state = { stories: [], chapters: [], goals: [], steps: [], journey: [] };
  loadGlobal([
    "storyById", "chaptersIn", "allChaptersIn", "currentChapter",
    "entryChapterId", "journeyByChapter"
  ]);

  function reset() {
    state.stories = [{ id: "q1", currentChapterId: "cB" }, { id: "q2" }];
    state.chapters = [
      { id: "cA", storyId: "q1", title: "A", status: "active" },
      { id: "cB", storyId: "q1", title: "B", status: "active" },
      { id: "cD", storyId: "q1", title: "Dormant", status: "dormant" },
      { id: "cE", storyId: "q1", title: "Empty", status: "active" },
      { id: "cX", storyId: "q2", title: "Other story", status: "active" }
    ];
    state.goals = [
      { id: "gA", storyId: "q1", chapterId: "cA" },
      { id: "gB", storyId: "q1", chapterId: "cB" },
      { id: "gD", storyId: "q1", chapterId: "cD" },
      { id: "gLoose", storyId: "q1", chapterId: null },
      { id: "gGone", storyId: "q1", chapterId: "cDeleted" },
      { id: "gX", storyId: "q2", chapterId: "cX" }
    ];
    state.steps = [
      { id: "sA", goalId: "gA" }, { id: "sB", goalId: "gB" }, { id: "sD", goalId: "gD" },
      { id: "sLoose", goalId: "gLoose" }, { id: "sNoGoal", goalId: null },
      { id: "sGone", goalId: "gGone" }, { id: "sX", goalId: "gX" }
    ];
  }
  const entry = (id, stepId, date) => ({ type: "journey", date, rec: { id, stepId, date } });
  const ids = (g) => g.items.map((it) => it.rec.id).join(",");

  t.section("an entry's chapter");
  reset();
  t.ok("through its step and goal", entryChapterId({ stepId: "sA" }) === "cA");
  t.ok("hand-logged: none", entryChapterId({ stepId: null }) === null);
  t.ok("step under no goal: none", entryChapterId({ stepId: "sNoGoal" }) === null);
  t.ok("goal under no chapter: none", entryChapterId({ stepId: "sLoose" }) === null);
  t.ok("step deleted: none, not a throw", entryChapterId({ stepId: "sDeleted" }) === null);
  state.steps[0].goalId = "gB";
  t.ok("moving the step moves its history", entryChapterId({ stepId: "sA" }) === "cB");

  t.section("grouping and order");
  reset();
  const items = [
    entry("j1", "sA", "2026-09-10"),
    entry("j2", "sD", "2026-09-09"),
    entry("j3", null, "2026-09-08"),
    entry("j4", "sB", "2026-09-07"),
    { type: "event", date: "2026-09-06", rec: { id: "e1", summary: "Trip" } },
    entry("j5", "sA", "2026-09-05"),
    entry("j6", "sGone", "2026-09-04"),
    entry("j7", "sX", "2026-09-03")
  ];
  const groups = journeyByChapter("q1", items);
  const order = groups.map((g) => (g.chapter ? g.chapter.id : "loose")).join(",");
  t.ok("current first, then active, then dormant, then loose", order === "cB,cA,cD,loose");
  t.ok("a chapter with no entries does not appear", !groups.some((g) => g.chapter && g.chapter.id === "cE"));
  t.ok("entries keep their order", ids(groups[1]) === "j1,j5");
  t.ok(
    "hand-logged, events, deleted-chapter and other-story entries land loose",
    ids(groups[3]) === "j3,e1,j6,j7"
  );
  t.ok("every entry appears exactly once", groups.reduce((n, g) => n + g.items.length, 0) === items.length);

  t.section("active chapters order by their newest entry");
  reset();
  state.stories[0].currentChapterId = null;
  const two = journeyByChapter("q1", [entry("j1", "sB", "2026-09-10"), entry("j2", "sA", "2026-09-01")]);
  t.ok("newer chapter first when none is current", two.map((g) => g.chapter.id).join(",") === "cB,cA");

  t.section("nothing loose, nothing extra");
  reset();
  const none = journeyByChapter("q1", [entry("j1", "sA", "2026-09-10")]);
  t.ok("no loose group when every entry has a chapter", none.length === 1 && none[0].chapter.id === "cA");
  t.ok("empty input, empty output", journeyByChapter("q1", []).length === 0);
};

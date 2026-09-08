/*
  goalsByChapter() and looseGoals() replace an IIFE that used to sit
  inline inside openStory's template literal, deciding which goals go
  under which chapter. See Phase 2 in the project plan: pull decisions
  out of renderers into pure, tested functions.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  loadGlobal(["goalsByChapter", "looseGoals"]);

  /* The logic exactly as it was written inline in openStory, kept here
     so the extraction can be proven equivalent rather than assumed. */
  const oldGrouped = (ss, gs) =>
    ss.map((s) => ({ chapter: s, goals: gs.filter((g) => g.chapterId === s.id) }));
  const oldLoose = (ss, gs) =>
    gs.filter((g) => !g.chapterId || !ss.some((s) => s.id === g.chapterId));

  const chapters = [
    { id: "c1", title: "Chapter one" },
    { id: "c2", title: "Chapter two" }
  ];
  const goals = [
    { id: "g1", title: "In chapter one", chapterId: "c1" },
    { id: "g2", title: "Also chapter one", chapterId: "c1" },
    { id: "g3", title: "In chapter two", chapterId: "c2" },
    { id: "g4", title: "No chapter at all", chapterId: null },
    { id: "g5", title: "Points at a deleted chapter", chapterId: "cGone" }
  ];

  t.section("grouping matches the goal to its chapter");
  const grouped = goalsByChapter(chapters, goals);
  t.ok("two chapter groups", grouped.length === 2);
  t.ok("chapter one gets both its goals", grouped[0].goals.map((g) => g.id).join(",") === "g1,g2");
  t.ok("chapter two gets its one goal", grouped[1].goals.map((g) => g.id).join(",") === "g3");
  t.ok("an empty chapter gets an empty array, not undefined", goalsByChapter([{ id: "cEmpty" }], goals)[0].goals.length === 0);

  t.section("loose goals");
  const loose = looseGoals(chapters, goals).map((g) => g.id);
  t.ok("catches a goal with no chapter", loose.includes("g4"));
  t.ok("catches a goal pointing at a deleted chapter", loose.includes("g5"));
  t.ok("does not catch a properly filed goal", !loose.includes("g1"));
  t.ok("exactly the two orphans, nothing else", loose.length === 2);

  t.section("equivalence with the original inline logic, randomised");
  let mismatches = 0;
  for (let run = 0; run < 200; run++) {
    const nc = Math.floor(Math.random() * 4);
    const rc = Array.from({ length: nc }, (_, i) => ({ id: "c" + i, title: "C" + i }));
    const ng = Math.floor(Math.random() * 10);
    const rg = Array.from({ length: ng }, (_, i) => ({
      id: "g" + i,
      chapterId: Math.random() < 0.3 ? null : "c" + Math.floor(Math.random() * (nc + 1))
    }));
    const a = JSON.stringify(goalsByChapter(rc, rg).map((x) => ({ c: x.chapter.id, g: x.goals.map((g) => g.id) })));
    const b = JSON.stringify(oldGrouped(rc, rg).map((x) => ({ c: x.chapter.id, g: x.goals.map((g) => g.id) })));
    const la = looseGoals(rc, rg).map((g) => g.id).join(",");
    const lb = oldLoose(rc, rg).map((g) => g.id).join(",");
    if (a !== b || la !== lb) mismatches++;
  }
  t.ok("identical output across 200 random chapter/goal sets", mismatches === 0);
};

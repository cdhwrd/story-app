/*
  The current chapter, and the line it puts under a Story's name on
  home. A Story can hold several goals, so the card shows the chapter
  the person has marked current instead of promoting one goal.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  global.state = { stories: [], chapters: [], goals: [] };
  loadGlobal([
    "storyById", "goals", "chaptersIn", "currentChapter", "storyLine",
    "pinCurrentChapter", "applyCurrentChoice"
  ]);

  function reset() {
    state.stories = [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }];
    state.chapters = [
      { id: "c1", storyId: "q1", title: "Learning the basics", status: "active" },
      { id: "c2", storyId: "q1", title: "First trip abroad", status: "active" },
      { id: "c3", storyId: "q1", title: "Winter", status: "dormant" },
      { id: "c4", storyId: "q2", title: "Only chapter", status: "active" }
    ];
    state.goals = [
      { id: "g1", storyId: "q1", title: "Goal one", status: "open" },
      { id: "g2", storyId: "q3", title: "Lone goal", status: "open" },
      { id: "g3", storyId: "q4", title: "Goal A", status: "open" },
      { id: "g4", storyId: "q4", title: "Goal B", status: "open" },
      { id: "g5", storyId: "q3", title: "Done goal", status: "complete" }
    ];
  }

  t.section("which chapter is current");
  reset();
  t.ok("two active chapters and no mark: none", currentChapter("q1") === null);
  state.stories[0].currentChapterId = "c2";
  t.ok("the marked chapter", currentChapter("q1")?.id === "c2");
  state.stories[0].currentChapterId = "c3";
  t.ok("a mark on a dormant chapter is ignored", currentChapter("q1") === null);
  state.stories[0].currentChapterId = "cGone";
  t.ok("a mark on a deleted chapter is ignored", currentChapter("q1") === null);
  state.stories[0].currentChapterId = "c4";
  t.ok("a mark on another Story's chapter is ignored", currentChapter("q1") === null);
  t.ok("a single active chapter is current without a mark", currentChapter("q2")?.id === "c4");
  t.ok("no chapters: none", currentChapter("q3") === null);
  t.ok("an unknown Story: none, not a throw", currentChapter("qNope") === null);

  t.section("the line under a Story's name");
  reset();
  state.stories[0].currentChapterId = "c1";
  t.ok("shows the current chapter over a goal", storyLine("q1") === "Learning the basics");
  t.ok("a single chapter shows itself", storyLine("q2") === "Only chapter");
  t.ok("one open goal and no chapter shows the goal", storyLine("q3") === "Lone goal");
  t.ok("several goals and no chapter shows nothing", storyLine("q4") === "");
  state.stories[0].currentChapterId = null;
  t.ok("several chapters and none marked falls back to its one goal", storyLine("q1") === "Goal one");

  t.section("adding a second chapter keeps the one being shown");
  reset();
  pinCurrentChapter("q2");
  state.chapters.push({ id: "c5", storyId: "q2", title: "New one", status: "active" });
  t.ok("the first chapter is still current", currentChapter("q2")?.id === "c4");
  t.ok("because it was written down", state.stories[1].currentChapterId === "c4");
  pinCurrentChapter("q4");
  t.ok("pinning with nothing current writes nothing", !("currentChapterId" in state.stories[3]));

  t.section("choosing in the edit modal");
  reset();
  applyCurrentChoice(state.chapters[1], "yes");
  t.ok("yes marks it", currentChapter("q1")?.id === "c2");
  applyCurrentChoice(state.chapters[0], "no");
  t.ok("no on another chapter leaves the mark alone", currentChapter("q1")?.id === "c2");
  applyCurrentChoice(state.chapters[1], "no");
  t.ok("no on the current chapter clears it", state.stories[0].currentChapterId === null);
  t.ok("and nothing is current", currentChapter("q1") === null);
};

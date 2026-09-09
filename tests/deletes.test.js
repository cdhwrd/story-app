/*
  The five delete paths, now driven by one rules table.

  The important test is the last section: it deletes something, counts
  what actually changed, and checks the confirmation sentence had told
  the truth. That cross-check is what stops the promise and the
  behaviour drifting apart, which is exactly how Story deletion ended up
  destroying Journey entries while Step deletion promised to keep them.
*/
const { loadGlobal } = require("./harness");

module.exports = async function (t) {
  let backups = [];
  global.writeBackup = async (snap, reason) => { backups.push(reason); };
  global.esc = (x) => String(x);
  global.state = {};

  loadGlobal([
    "plural", "storyById", "DELETE_RULES", "deleteImpact", "deleteMessage", "applyDelete"
  ]);

  function reset() {
    state = {
      mainStoryId: "q1",
      stories: [
        { id: "q1", name: "Writing" },
        { id: "q2", name: "Moving" }
      ],
      chapters: [
        { id: "c1", storyId: "q1", title: "Early drafts" },
        { id: "c2", storyId: "q2", title: "Other story chapter" }
      ],
      goals: [
        { id: "g1", storyId: "q1", chapterId: "c1", title: "Finish chapter one" },
        { id: "g2", storyId: "q1", chapterId: "c1", title: "Second goal" },
        { id: "g3", storyId: "q2", chapterId: "c2", title: "Other story goal" }
      ],
      steps: [
        { id: "t1", storyId: "q1", goalId: "g1", title: "Write 200 words", status: "open" },
        { id: "t2", storyId: "q1", goalId: "g1", title: "Edit", status: "open" },
        { id: "t3", storyId: "q2", goalId: "g3", title: "Other story step", status: "open" }
      ],
      journey: [
        { id: "a1", storyId: "q1", stepId: "t1", note: "Wrote", date: "2026-05-01" },
        { id: "a2", storyId: "q2", stepId: "t3", note: "Other", date: "2026-05-02" }
      ],
      events: [
        { id: "e1", storyId: "q1", summary: "Reading", start: { date: "2026-06-01" }, end: { date: "2026-06-02" } },
        { id: "e2", storyId: null, summary: "Dentist", start: { date: "2026-06-03" }, end: { date: "2026-06-04" } }
      ]
    };
    global.state = state;
    backups = [];
  }

  t.section("deleting a chapter unfiles its goals");
  reset();
  t.ok("impact reports two goals", deleteImpact("chapter", "c1").unfiled.goals === 2);
  await applyDelete("chapter", "c1");
  t.ok("chapter is gone", !state.chapters.some((x) => x.id === "c1"));
  t.ok("its goals survive", state.goals.filter((g) => g.storyId === "q1").length === 2);
  t.ok("they are unfiled, not deleted", state.goals.filter((g) => g.chapterId === null).length === 2);
  t.ok("another story's chapter is untouched", state.chapters.some((x) => x.id === "c2"));

  t.section("deleting a goal unfiles its steps");
  reset();
  t.ok("impact reports two steps", deleteImpact("goal", "g1").unfiled.steps === 2);
  await applyDelete("goal", "g1");
  t.ok("goal is gone", !state.goals.some((x) => x.id === "g1"));
  t.ok("its steps survive", state.steps.filter((x) => x.storyId === "q1").length === 2);
  t.ok("they are unfiled", state.steps.filter((x) => x.goalId === null).length === 2);

  t.section("deleting a step keeps its Journey entries");
  reset();
  await applyDelete("step", "t1");
  t.ok("step is gone", !state.steps.some((x) => x.id === "t1"));
  t.ok("its Journey entry stays", state.journey.some((a) => a.id === "a1"));
  t.ok("the message says so", deleteMessage("step", "t2").includes("Journey stays"));

  t.section("deleting a Journey entry removes only that entry");
  reset();
  await applyDelete("entry", "a1");
  t.ok("entry is gone", !state.journey.some((a) => a.id === "a1"));
  t.ok("the step it came from survives", state.steps.some((x) => x.id === "t1"));
  t.ok("other entries survive", state.journey.length === 1);

  t.section("deleting a Story removes everything in it, and nothing else");
  reset();
  const imp = deleteImpact("story", "q1");
  t.ok("counts one chapter", imp.removed.chapters === 1);
  t.ok("counts two goals", imp.removed.goals === 2);
  t.ok("counts two steps", imp.removed.steps === 2);
  t.ok("counts one entry", imp.removed.entries === 1);
  await applyDelete("story", "q1");
  t.ok("the story is gone", !state.stories.some((x) => x.id === "q1"));
  t.ok("the other story survives whole", state.stories.length === 1 && state.chapters.length === 1 && state.goals.length === 1 && state.steps.length === 1 && state.journey.length === 1);
  t.ok("a backup was written first", backups.includes("pre-delete-story"));
  t.ok("main story falls back to a surviving one", state.mainStoryId === "q2");

  t.section("unknown ids are refused");
  reset();
  t.ok("applyDelete returns false", await applyDelete("story", "nope") === false);
  t.ok("nothing changed", state.stories.length === 2);
  t.ok("message is empty", deleteMessage("goal", "nope") === "");

  t.section("the confirmation text tells the truth");
  for (const [kind, id] of [["chapter", "c1"], ["goal", "g1"], ["step", "t1"], ["entry", "a1"], ["story", "q1"]]) {
    reset();
    const msg = deleteMessage(kind, id);
    const before = {
      chapters: state.chapters.length, goals: state.goals.length,
      steps: state.steps.length, acts: state.journey.length
    };
    await applyDelete(kind, id);
    const removed = {
      chapters: before.chapters - state.chapters.length, goals: before.goals - state.goals.length,
      steps: before.steps - state.steps.length, acts: before.acts - state.journey.length
    };
    if (kind === "chapter") {
      t.ok("chapter message promises goals survive, and they do", msg.includes("will stay") && removed.goals === 0);
    }
    if (kind === "goal") {
      t.ok("goal message promises steps survive, and they do", msg.includes("will stay") && removed.steps === 0);
    }
    if (kind === "step") {
      t.ok("step message promises entries survive, and they do", msg.includes("Journey stays") && removed.acts === 0);
    }
    if (kind === "story") {
      t.ok("story message counts match what was removed",
        msg.includes("1 chapter") && msg.includes("2 goals") && msg.includes("2 steps") &&
        removed.chapters === 1 && removed.goals === 2 && removed.steps === 2);
    }
    t.ok(`${kind} message names the subject`, kind === "entry" ? msg.includes("Wrote") : msg.length > 0);
  }

};

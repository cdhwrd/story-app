/*
  Quick-add on the Story page. A new step is filed under no goal, even
  when the Story has goals, because picking the first one was arbitrary
  once a Story held several.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  let input = { value: "" };
  let toasts = [];
  global.document = { getElementById: () => input };
  global.save = () => {};
  global.toast = (m) => toasts.push(m);
  global.openStory = () => {};
  global.state = {
    steps: [],
    goals: [
      { id: "g1", storyId: "q1", title: "First goal", status: "active" },
      { id: "g2", storyId: "q1", title: "Second goal", status: "active" }
    ]
  };

  loadGlobal(["newId", "addQuickStep"]);

  t.section("a quick-added step starts under no goal");
  input.value = "  Wax the board  ";
  addQuickStep("q1");
  const made = state.steps[0];
  t.ok("one step was added", state.steps.length === 1);
  t.ok("goalId is null although the Story has goals", made.goalId === null);
  t.ok("goalId is present, not missing", "goalId" in made);
  t.ok("title is trimmed", made.title === "Wax the board");
  t.ok("belongs to the Story it was added in", made.storyId === "q1");
  t.ok("starts open", made.status === "open");

  t.section("an empty title adds nothing");
  input.value = "   ";
  addQuickStep("q1");
  t.ok("still one step", state.steps.length === 1);
  t.ok("says why", toasts.includes("Add a step first"));
};
